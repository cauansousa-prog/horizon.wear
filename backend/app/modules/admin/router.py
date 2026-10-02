import json
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel,Field,ConfigDict,model_validator
from typing import Literal
from urllib.parse import quote
from fastapi import APIRouter,Depends,HTTPException,Query
import plotly.graph_objects as go
from ...auth import User,current_user
from ...database import Database,get_database
from ..payments.gateway import MercadoPago,apply_payment,privileged_rpc

router=APIRouter(prefix='/admin',tags=['administração'])
PAID_ORDER_STATUSES={'pagamento_aprovado','preparando','enviado','entregue'}
MONTHS_PT=('Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez')
FORTALEZA_TZ=timezone(timedelta(hours=-3))

async def admin(user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/profiles',token=user.token,params={'select':'role','id':'eq.'+user.id,'limit':'1'})
    if not rows or rows[0]['role']!='admin':raise HTTPException(403,'Acesso exclusivo da administração.')
    return user

class Product(BaseModel):
    model_config=ConfigDict(extra='forbid')
    nome:str=Field(min_length=2,max_length=160)
    slug:str=Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$',max_length=180)
    categoria_id:UUID
    descricao:str=Field(default='',max_length=5000)
    tecido:str=Field(default='',max_length=200)
    caimento:str=Field(default='',max_length=200)
    preco:Decimal=Field(gt=0,max_digits=12,decimal_places=2)
    preco_promocional:Decimal|None=Field(default=None,gt=0,max_digits=12,decimal_places=2)
    ativo:bool=False
    destaque:bool=False
    lancamento:bool=False
    @model_validator(mode='after')
    def promotion(self):
        if self.preco_promocional is not None and self.preco_promocional>=self.preco:raise ValueError('Promoção deve ser menor que o preço.')
        return self
class Size(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id:UUID
    tamanho:str=Field(min_length=1,max_length=20)
    estoque:int=Field(ge=0,le=100000,strict=True)
class Image(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id:UUID
    url:str=Field(pattern=r'^https://',max_length=2048)
    ordem:int=Field(default=0,ge=0,le=100)
class Category(BaseModel):
    model_config=ConfigDict(extra='forbid')
    nome:str=Field(min_length=2,max_length=80)
    slug:str=Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$',max_length=100)
    grupo:str=Field(pattern=r'^(roupas|calcados|relogios|acessorios)$')
    imagem_url:str=Field(pattern=r'^https://',max_length=2048)
    ordem:int=Field(default=0,ge=0)

class Fulfillment(BaseModel):
    model_config=ConfigDict(extra='forbid')
    status:Literal['preparando','enviado','entregue']
    rastreio:str=Field(default='',max_length=120)

def _as_datetime(value):
    if not value:return None
    try:
        parsed=datetime.fromisoformat(str(value).replace('Z','+00:00'))
        if parsed.tzinfo is None:parsed=parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(FORTALEZA_TZ)
    except (TypeError,ValueError):
        return None

def _confirmed_payment(order):
    approved=[p for p in (order.get('payments') or []) if p.get('status')=='approved']
    if approved:
        approved.sort(key=lambda p:p.get('aprovado_em') or '',reverse=True)
        return approved[0]
    if order.get('status') in PAID_ORDER_STATUSES and not order.get('review_required'):
        return {'order_id':order.get('id'),'metodo':'confirmado','status':'approved',
                'valor':order.get('total') or 0,'aprovado_em':order.get('created_at')}
    return None

def _demo_payment(payment):
    return str((payment or {}).get('mercadopago_payment_id') or '').startswith('DEMO-')

async def _reconcile_open_payments(db,user):
    """Reconcilia cobranças abertas com o Mercado Pago.

    Primeiro atualiza IDs de pagamento já gravados. Depois procura, pelo external_reference,
    pedidos ainda em "recebido" cuja confirmação não chegou ao Supabase. Assim o faturamento
    se recupera mesmo quando o webhook ou a gravação inicial falham.
    """
    if not db.settings.mercadopago_access_token.get_secret_value():
        return 0
    gateway=MercadoPago(db.client,db.settings)
    updated=0

    try:
        rows=await db.request('/rest/v1/payments',token=user.token,params={
            'select':'mercadopago_payment_id,status',
            'status':'in.(pending,in_process,authorized)',
            'mercadopago_payment_id':'not.is.null',
            'order':'created_at.desc','limit':'50'
        })
    except HTTPException:
        rows=[]

    for row in rows or []:
        payment_id=str(row.get('mercadopago_payment_id') or '')
        if not payment_id.isdigit():
            continue
        try:
            payment=await gateway.request('/v1/payments/'+payment_id)
            await apply_payment(db,payment)
            if payment.get('status')!=row.get('status'):
                updated+=1
        except HTTPException:
            continue

    # Recuperação adicional: se o pedido foi criado mas a tabela payments não recebeu
    # a confirmação, busca a cobrança no Mercado Pago usando o UUID salvo em
    # external_reference. Limitamos aos pedidos mais recentes ainda não confirmados.
    try:
        open_orders=await db.request('/rest/v1/orders',token=user.token,params={
            'select':'id,status,created_at,payments(status,mercadopago_payment_id)',
            'status':'eq.recebido','order':'created_at.desc','limit':'20'
        })
    except HTTPException:
        open_orders=[]

    for order in open_orders or []:
        nested=order.get('payments') or []
        if any(p.get('status')=='approved' for p in nested):
            continue
        # IDs já existentes foram consultados acima. Aqui o search também cobre o caso
        # em que a cobrança existe no Mercado Pago, mas nenhum registro local foi criado.
        try:
            result=await gateway.request('/v1/payments/search?external_reference='+quote(str(order['id']),safe=''))
            candidates=result.get('results') if isinstance(result,dict) else None
            if not isinstance(candidates,list):
                continue
            candidates=[p for p in candidates if str(p.get('external_reference'))==str(order['id'])]
            candidates.sort(key=lambda p:p.get('date_last_updated') or p.get('date_created') or '',reverse=True)
            preferred=next((p for p in candidates if p.get('status')=='approved'),candidates[0] if candidates else None)
            if not preferred:
                continue
            await apply_payment(db,preferred)
            updated+=1
        except HTTPException:
            continue
    return updated

async def _orders_with_sales(db,user):
    orders=[];offset=0
    select='id,codigo,nome_cliente,status,review_required,total,created_at,order_items(nome_produto,tamanho,quantidade),payments(order_id,metodo,status,valor,aprovado_em,mercadopago_payment_id)'
    while True:
        page=await db.request('/rest/v1/orders',token=user.token,params={
            'select':select,'order':'created_at.desc','offset':str(offset),'limit':'1000'})
        orders.extend(page)
        if len(page)<1000:break
        offset+=1000
    return orders

@router.get('/dashboard')
async def dashboard(user:User=Depends(admin),db:Database=Depends(get_database)):
    reconciled=await _reconcile_open_payments(db,user)
    orders=await _orders_with_sales(db,user)
    statuses={}
    for order in orders:statuses[order['status']]=statuses.get(order['status'],0)+1
    purchases=[]
    real_revenue=Decimal('0');demo_revenue=Decimal('0');real_paid=0;demo_paid=0
    for order in orders:
        payment=_confirmed_payment(order)
        if not payment:continue
        amount=Decimal(str(payment.get('valor') if payment.get('valor') is not None else order.get('total') or 0))
        is_demo=_demo_payment(payment)
        if is_demo:
            demo_revenue+=amount;demo_paid+=1
        else:
            real_revenue+=amount;real_paid+=1
        purchases.append({
            'id':order['id'],'codigo':order.get('codigo'),'nome_cliente':order.get('nome_cliente') or 'Cliente',
            'status':order.get('status'),'total':str(amount),'metodo':payment.get('metodo') or '—',
            'payment_status':payment.get('status'),'approved_at':payment.get('aprovado_em') or order.get('created_at'),
            'demo':is_demo,'items':order.get('order_items') or []
        })
    return {'orders':len(orders),'paid_orders':real_paid,'demo_paid_orders':demo_paid,
            'revenue':str(real_revenue.quantize(Decimal('.01'))),
            'demo_revenue':str(demo_revenue.quantize(Decimal('.01'))),
            'statuses':statuses,'recent_purchases':purchases[:8],'payments_reconciled':reconciled}

def _sales_rows(orders,mode='real'):
    result=[]
    for order in orders:
        payment=_confirmed_payment(order)
        if not payment:
            continue
        is_demo=_demo_payment(payment)
        if (mode=='demo' and not is_demo) or (mode=='real' and is_demo):
            continue
        paid_at=_as_datetime(payment.get('aprovado_em') or order.get('created_at'))
        if not paid_at:
            continue
        amount=Decimal(str(payment.get('valor') if payment.get('valor') is not None else order.get('total') or 0))
        result.append((order,payment,paid_at,amount))
    return result

def _revenue_period(period,now):
    start=now.replace(hour=0,minute=0,second=0,microsecond=0)
    if period=='day':
        labels=[f'{hour:02d}h' for hour in range(24)]
        return start,start+timedelta(days=1),labels,lambda value:value.hour,'Hoje'
    if period=='week':
        start=start-timedelta(days=start.weekday())
        labels=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
        return start,start+timedelta(days=7),labels,lambda value:(value.date()-start.date()).days,'Esta semana'
    if period=='month':
        start=start.replace(day=1)
        days=monthrange(start.year,start.month)[1]
        next_month=(start.replace(day=28)+timedelta(days=4)).replace(day=1)
        labels=[str(day) for day in range(1,days+1)]
        return start,next_month,labels,lambda value:value.day-1,start.strftime('%m/%Y')
    start=start.replace(month=1,day=1)
    labels=list(MONTHS_PT)
    return start,start.replace(year=start.year+1),labels,lambda value:value.month-1,str(start.year)

@router.get('/revenue/chart')
async def revenue_chart(period:Literal['day','week','month','year']='month',
                        mode:Literal['real','demo']='real',
                        user:User=Depends(admin),db:Database=Depends(get_database)):
    reconciled=await _reconcile_open_payments(db,user)
    orders=await _orders_with_sales(db,user)
    now=datetime.now(FORTALEZA_TZ)
    start,end,labels,bucket,title=_revenue_period(period,now)
    totals=[Decimal('0') for _ in labels]
    counts=[0 for _ in labels]
    for order,payment,paid_at,amount in _sales_rows(orders,mode):
        if not start<=paid_at<end:
            continue
        index=bucket(paid_at)
        if 0<=index<len(labels):
            totals[index]+=amount
            counts[index]+=1
    total=sum(totals,Decimal('0')).quantize(Decimal('.01'))
    values=[float(value.quantize(Decimal('.01'))) for value in totals]
    fig=go.Figure(go.Bar(
        x=labels,y=values,customdata=counts,name='Faturamento',
        marker={'color':'#344e39','line':{'color':'#c9a55c','width':1}},
        hovertemplate='<b>%{x}</b><br>Faturamento: R$ %{y:,.2f}<br>Compras pagas: %{customdata}<extra></extra>'
    ))
    fig.update_layout(
        title={'text':f'Faturamento — {title}','x':0,'xanchor':'left'},
        paper_bgcolor='rgba(0,0,0,0)',plot_bgcolor='rgba(0,0,0,0)',
        font={'family':'Inter, Arial, sans-serif','color':'#394236','size':12},
        margin={'l':58,'r':24,'t':58,'b':48},height=360,showlegend=False,
        bargap=.25,hoverlabel={'bgcolor':'#253d2b','font':{'color':'#ffffff'}},
        xaxis={'fixedrange':True,'showgrid':False,'linecolor':'#dfe3d8','tickfont':{'color':'#6f786b'}},
        yaxis={'fixedrange':True,'rangemode':'tozero','gridcolor':'#e6e9e1','zeroline':False,
               'tickprefix':'R$ ','tickformat':',.0f','title':'Faturamento'}
    )
    points=[{'label':labels[i],'revenue':f'{totals[i]:.2f}','orders':counts[i]} for i in range(len(labels))]
    return {'period':period,'mode':mode,'label':title,'start':start.isoformat(),'end':end.isoformat(),
            'total':str(total),'orders':sum(counts),'points':points,
            'payments_reconciled':reconciled,'figure':json.loads(fig.to_json())}

@router.get('/revenue/annual')
async def annual_revenue(year:int|None=Query(default=None,ge=2020,le=2100),
                         user:User=Depends(admin),db:Database=Depends(get_database)):
    await _reconcile_open_payments(db,user)
    orders=await _orders_with_sales(db,user)
    paid=[]
    years=set()
    for order in orders:
        payment=_confirmed_payment(order)
        if not payment or _demo_payment(payment):continue
        paid_at=_as_datetime(payment.get('aprovado_em') or order.get('created_at'))
        if not paid_at:continue
        years.add(paid_at.year)
        paid.append((order,payment,paid_at))
    current_year=datetime.now(FORTALEZA_TZ).year
    selected=year or current_year
    years.add(selected)
    totals=[Decimal('0') for _ in range(12)]
    counts=[0 for _ in range(12)]
    for order,payment,paid_at in paid:
        if paid_at.year!=selected:continue
        index=paid_at.month-1
        totals[index]+=Decimal(str(payment.get('valor') if payment.get('valor') is not None else order.get('total') or 0))
        counts[index]+=1
    total=sum(totals,Decimal('0')).quantize(Decimal('.01'))
    values=[float(v.quantize(Decimal('.01'))) for v in totals]
    fig=go.Figure(go.Bar(
        x=list(MONTHS_PT),y=values,customdata=counts,name='Faturamento',
        marker={'color':'#344e39','line':{'color':'#c9a55c','width':1}},
        hovertemplate='<b>%{x}</b><br>Faturamento: R$ %{y:,.2f}<br>Compras pagas: %{customdata}<extra></extra>'
    ))
    fig.update_layout(
        title={'text':f'Faturamento mensal de {selected}','x':0,'xanchor':'left'},
        paper_bgcolor='rgba(0,0,0,0)',plot_bgcolor='rgba(0,0,0,0)',
        font={'family':'Inter, Arial, sans-serif','color':'#394236','size':12},
        margin={'l':58,'r':24,'t':58,'b':48},height=360,showlegend=False,
        bargap=.28,hoverlabel={'bgcolor':'#253d2b','font':{'color':'#ffffff'}},
        xaxis={'fixedrange':True,'showgrid':False,'linecolor':'#dfe3d8','tickfont':{'color':'#6f786b'}},
        yaxis={'fixedrange':True,'rangemode':'tozero','gridcolor':'#e6e9e1','zeroline':False,
               'tickprefix':'R$ ','tickformat':',.0f','title':'Faturamento'}
    )
    figure=json.loads(fig.to_json())
    months=[{'month':MONTHS_PT[i],'revenue':f'{totals[i]:.2f}','orders':counts[i]} for i in range(12)]
    return {'year':selected,'available_years':sorted(years,reverse=True),'total':str(total),
            'months':months,'figure':figure}

@router.get('/{resource}')
async def listing(resource:str,offset:int=Query(0,ge=0),user:User=Depends(admin),db:Database=Depends(get_database)):
    if resource not in {'products','categories','product_sizes','product_images','orders','profiles','payments','coupons','reviews'}:raise HTTPException(404)
    order='created_at.desc' if resource in {'orders','payments','reviews'} else 'id'
    return await db.request('/rest/v1/'+resource,token=user.token,params={'select':'*','order':order,'limit':'100','offset':str(offset)})

@router.post('/products',status_code=201)
async def create_product(body:Product,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/products',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.put('/products/{product_id}')
async def update_product(product_id:UUID,body:Product,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/products',method='PATCH',token=user.token,params={'id':'eq.'+str(product_id)},json=body.model_dump(mode='json'))
@router.delete('/products/{product_id}')
async def deactivate_product(product_id:UUID,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/products',method='PATCH',token=user.token,params={'id':'eq.'+str(product_id)},json={'ativo':False})
@router.post('/sizes',status_code=201)
async def create_size(body:Size,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/product_sizes',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.put('/sizes/{size_id}')
async def update_size(size_id:UUID,body:Size,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/product_sizes',method='PATCH',token=user.token,params={'id':'eq.'+str(size_id),'product_id':'eq.'+str(body.product_id)},json={'estoque':body.estoque,'tamanho':body.tamanho})
@router.post('/images',status_code=201)
async def add_image(body:Image,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/product_images',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.post('/categories',status_code=201)
async def add_category(body:Category,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/categories',method='POST',token=user.token,json=body.model_dump())

@router.patch('/orders/{order_id}/fulfillment')
async def fulfillment(order_id:UUID,body:Fulfillment,user:User=Depends(admin),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/orders',token=user.token,
                          params={'select':'id,status,review_required','id':'eq.'+str(order_id),'limit':'1'})
    if not rows:raise HTTPException(404,'Pedido não encontrado.')
    current=rows[0]
    if current['review_required']:raise HTTPException(409,'Pedido em revisão de estoque.')
    next_status={'pagamento_aprovado':'preparando','preparando':'enviado','enviado':'entregue'}.get(current['status'])
    if body.status!=next_status:raise HTTPException(409,'Confirme o pagamento e avance uma etapa por vez.')
    if body.status=='enviado' and not body.rastreio.strip():raise HTTPException(422,'Informe o código de rastreio.')
    return await privileged_rpc(db,'horizon_advance_order',
                                {'p_order':str(order_id),'p_target':body.status,'p_tracking':body.rastreio.strip()})
