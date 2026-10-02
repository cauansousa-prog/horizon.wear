import csv
import io
import json
import zipfile
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel,Field,ConfigDict,model_validator
from typing import Literal
from xml.sax.saxutils import escape
from urllib.parse import quote
from fastapi import APIRouter,Depends,HTTPException,Query
from fastapi.responses import Response
import plotly.graph_objects as go
from ...auth import User,current_user
from ...database import Database,get_database
from ..payments.gateway import MercadoPago,apply_payment,privileged_rpc

router=APIRouter(prefix='/admin',tags=['administração'])
PAID_ORDER_STATUSES={'pagamento_aprovado','preparando','enviado','entregue'}
MONTHS_PT=('Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez')
FORTALEZA_TZ=timezone(timedelta(hours=-3))
Permission=Literal['dashboard','catalog','orders','finance','customers','marketing','reviews','exports','manage_admins']
ADMIN_PERMISSIONS=('dashboard','catalog','orders','finance','customers','marketing','reviews','exports','manage_admins')
RESOURCE_PERMISSIONS={
    'products':'catalog','product_sizes':'catalog','categories':'catalog','product_images':'catalog',
    'orders':'orders','profiles':'customers','payments':'finance','coupons':'marketing','reviews':'reviews'
}

async def admin(user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.admin_request('/rest/v1/profiles',params={'select':'role','id':'eq.'+user.id,'limit':'1'})
    if not rows or rows[0].get('role')!='admin':raise HTTPException(403,'Acesso exclusivo da administração.')
    return user

async def _permissions(user:User,db:Database):
    auth_user=await db.admin_request('/auth/v1/admin/users/'+user.id)
    app_meta=(auth_user or {}).get('app_metadata') or {}
    configured=app_meta.get('admin_permissions')
    if configured is None:
        return set(ADMIN_PERMISSIONS),True
    allowed={str(item) for item in configured if str(item) in ADMIN_PERMISSIONS} if isinstance(configured,list) else set()
    return allowed,False

async def _require(user:User,db:Database,permission:str):
    allowed,_=await _permissions(user,db)
    if permission not in allowed:
        raise HTTPException(403,'Sua função administrativa não permite esta ação.')
    return allowed

class StaffUpdate(BaseModel):
    model_config=ConfigDict(extra='forbid')
    is_admin:bool
    permissions:list[Permission]=Field(default_factory=list,max_length=len(ADMIN_PERMISSIONS))
    @model_validator(mode='after')
    def unique_permissions(self):
        self.permissions=list(dict.fromkeys(self.permissions))
        return self

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
    await _require(user,db,'dashboard')
    reconciled=await _reconcile_open_payments(db,user)
    orders=await _orders_with_sales(db,user)
    statuses={}
    for order in orders:statuses[order['status']]=statuses.get(order['status'],0)+1
    purchases=[]
    revenue=Decimal('0');paid_orders=0;demo_revenue=Decimal('0');demo_paid=0
    for order in orders:
        payment=_confirmed_payment(order)
        if not payment:continue
        amount=Decimal(str(payment.get('valor') if payment.get('valor') is not None else order.get('total') or 0))
        is_demo=_demo_payment(payment)
        revenue+=amount;paid_orders+=1
        if is_demo:
            demo_revenue+=amount;demo_paid+=1
        purchases.append({
            'id':order['id'],'codigo':order.get('codigo'),'nome_cliente':order.get('nome_cliente') or 'Cliente',
            'status':order.get('status'),'total':str(amount),'metodo':payment.get('metodo') or '—',
            'payment_status':payment.get('status'),'approved_at':payment.get('aprovado_em') or order.get('created_at'),
            'demo':is_demo,'items':order.get('order_items') or []
        })
    return {'orders':len(orders),'paid_orders':paid_orders,'demo_paid_orders':demo_paid,
            'revenue':str(revenue.quantize(Decimal('.01'))),
            'demo_revenue':str(demo_revenue.quantize(Decimal('.01'))),
            'statuses':statuses,'recent_purchases':purchases[:8],'payments_reconciled':reconciled}

def _sales_rows(orders,mode='all'):
    result=[]
    for order in orders:
        payment=_confirmed_payment(order)
        if not payment:
            continue
        is_demo=_demo_payment(payment)
        if mode=='demo' and not is_demo:
            continue
        if mode=='real' and is_demo:
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
                        mode:Literal['all','real','demo']='all',
                        user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'dashboard')
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
    await _require(user,db,'dashboard')
    await _reconcile_open_payments(db,user)
    orders=await _orders_with_sales(db,user)
    paid=[]
    years=set()
    for order in orders:
        payment=_confirmed_payment(order)
        if not payment:continue
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


@router.get('/me')
async def admin_me(user:User=Depends(admin),db:Database=Depends(get_database)):
    allowed,owner=await _permissions(user,db)
    return {'user_id':user.id,'permissions':sorted(allowed),'owner':owner}

@router.get('/staff')
async def staff(user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'manage_admins')
    profiles=await db.admin_request('/rest/v1/profiles',params={
        'select':'id,nome_completo,telefone,role','order':'nome_completo.asc','limit':'200'
    }) or []
    auth_data=await db.admin_request('/auth/v1/admin/users',params={'page':'1','per_page':'200'})
    auth_users=(auth_data or {}).get('users',[]) if isinstance(auth_data,dict) else []
    by_id={str(item.get('id')):item for item in auth_users if isinstance(item,dict)}
    result=[]
    for profile in profiles:
        aid=str(profile.get('id'));auth=by_id.get(aid,{})
        meta=auth.get('app_metadata') or {}
        configured=meta.get('admin_permissions')
        is_admin=profile.get('role')=='admin'
        permissions=list(ADMIN_PERMISSIONS) if is_admin and configured is None else (
            [p for p in configured if p in ADMIN_PERMISSIONS] if isinstance(configured,list) else []
        )
        result.append({
            'id':aid,'name':profile.get('nome_completo') or 'Sem nome','email':auth.get('email') or '',
            'is_admin':is_admin,'permissions':permissions,'owner':is_admin and configured is None,
            'self':aid==user.id
        })
    return result

@router.patch('/staff/{target_id}')
async def update_staff(target_id:UUID,body:StaffUpdate,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'manage_admins')
    if str(target_id)==user.id:
        raise HTTPException(409,'Para evitar perder o acesso, sua própria conta principal não pode ser alterada por esta tela.')
    existing=await db.admin_request('/auth/v1/admin/users/'+str(target_id))
    if not existing:
        raise HTTPException(404,'Usuário não encontrado.')
    app_meta=dict((existing.get('app_metadata') or {}))
    app_meta['admin_permissions']=body.permissions if body.is_admin else []
    await db.admin_request('/auth/v1/admin/users/'+str(target_id),method='PUT',json={'app_metadata':app_meta})
    changed=await db.admin_request('/rest/v1/profiles',method='PATCH',
        params={'id':'eq.'+str(target_id),'select':'id,role'},
        json={'role':'admin' if body.is_admin else 'cliente'})
    if not changed:
        raise HTTPException(404,'Perfil não encontrado.')
    return {'saved':True,'is_admin':body.is_admin,'permissions':body.permissions if body.is_admin else []}

def _safe_sheet_value(value):
    if value is None:return ''
    if isinstance(value,bool):return 'Sim' if value else 'Não'
    text=str(value)
    if text.startswith(('=','+','-','@')):text="'"+text
    return text

def _column_name(index):
    result=''
    while index:
        index,rem=divmod(index-1,26);result=chr(65+rem)+result
    return result

def _xlsx_document(headers,rows,sheet_name='Dados'):
    all_rows=[headers]+rows
    xml_rows=[]
    for row_no,row in enumerate(all_rows,1):
        cells=[]
        for col_no,value in enumerate(row,1):
            ref=f'{_column_name(col_no)}{row_no}'
            style=' s="1"' if row_no==1 else ''
            safe=escape(_safe_sheet_value(value))
            cells.append(f'<c r="{ref}" t="inlineStr"{style}><is><t xml:space="preserve">{safe}</t></is></c>')
        xml_rows.append(f'<row r="{row_no}">{"".join(cells)}</row>')
    sheet_xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join(xml_rows) + '</sheetData></worksheet>'
    workbook_xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' \
        f'<sheets><sheet name="{escape(sheet_name[:31])}" sheetId="1" r:id="rId1"/></sheets></workbook>'
    styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font/><font><b/></font></fonts>' \
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders>' \
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' \
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' \
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    content_types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' \
        '<Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' \
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' \
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
    root_rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    workbook_rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' \
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as book:
        book.writestr('[Content_Types].xml',content_types)
        book.writestr('_rels/.rels',root_rels)
        book.writestr('xl/workbook.xml',workbook_xml)
        book.writestr('xl/_rels/workbook.xml.rels',workbook_rels)
        book.writestr('xl/worksheets/sheet1.xml',sheet_xml)
        book.writestr('xl/styles.xml',styles)
    return output.getvalue()

def _export_response(headers,rows,name,fmt):
    if fmt=='csv':
        buffer=io.StringIO(newline='')
        writer=csv.writer(buffer);writer.writerow(headers)
        for row in rows:writer.writerow([_safe_sheet_value(v) for v in row])
        content='\ufeff'+buffer.getvalue()
        return Response(content=content.encode('utf-8'),media_type='text/csv; charset=utf-8',
                        headers={'Content-Disposition':f'attachment; filename="{name}.csv"'})
    content=_xlsx_document(headers,rows,name)
    return Response(content=content,media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition':f'attachment; filename="{name}.xlsx"'})

async def _all_rows(db,user,resource,select):
    rows=[];offset=0
    while True:
        page=await db.request('/rest/v1/'+resource,token=user.token,params={
            'select':select,'order':'created_at.desc','offset':str(offset),'limit':'1000'})
        rows.extend(page or [])
        if len(page or [])<1000:break
        offset+=1000
    return rows

@router.get('/export/{resource}')
async def export_resource(resource:Literal['orders','payments','products','profiles'],
                          format:Literal['csv','xlsx']='csv',
                          user:User=Depends(admin),db:Database=Depends(get_database)):
    permission={'orders':'orders','payments':'finance','products':'catalog','profiles':'customers'}[resource]
    await _require(user,db,'exports');await _require(user,db,permission)
    if resource=='orders':
        data=await _all_rows(db,user,'orders','codigo,nome_cliente,email_cliente,status,total,created_at')
        headers=['Pedido','Cliente','E-mail','Status','Total','Criado em']
        rows=[[r.get('codigo'),r.get('nome_cliente'),r.get('email_cliente'),r.get('status'),r.get('total'),r.get('created_at')] for r in data]
    elif resource=='payments':
        data=await _all_rows(db,user,'payments','order_id,metodo,status,valor,aprovado_em,created_at')
        headers=['Pedido','Método','Status','Valor','Aprovado em','Criado em']
        rows=[[r.get('order_id'),r.get('metodo'),r.get('status'),r.get('valor'),r.get('aprovado_em'),r.get('created_at')] for r in data]
    elif resource=='products':
        data=await _all_rows(db,user,'products','id,nome,slug,preco,preco_promocional,ativo,vendas_total,created_at')
        headers=['ID','Produto','Slug','Preço','Preço promocional','Ativo','Vendas','Criado em']
        rows=[[r.get('id'),r.get('nome'),r.get('slug'),r.get('preco'),r.get('preco_promocional'),r.get('ativo'),r.get('vendas_total'),r.get('created_at')] for r in data]
    else:
        data=await _all_rows(db,user,'profiles','id,nome_completo,telefone,role,created_at')
        headers=['ID','Nome','Telefone','Perfil','Criado em']
        rows=[[r.get('id'),r.get('nome_completo'),r.get('telefone'),r.get('role'),r.get('created_at')] for r in data]
    return _export_response(headers,rows,resource,format)

@router.get('/export-sales')
async def export_sales(period:Literal['day','week','month','year']='month',
                       format:Literal['csv','xlsx']='csv',
                       user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'exports');await _require(user,db,'dashboard')
    orders=await _orders_with_sales(db,user)
    start,end,_,_,label=_revenue_period(period,datetime.now(FORTALEZA_TZ))
    rows=[]
    for order,payment,paid_at,amount in _sales_rows(orders,'all'):
        if start<=paid_at<end:
            rows.append([order.get('codigo'),order.get('nome_cliente'),payment.get('metodo'),payment.get('status'),
                         str(amount),paid_at.isoformat(),_demo_payment(payment)])
    headers=['Pedido','Cliente','Método','Status','Valor','Aprovado em','Demonstração']
    return _export_response(headers,rows,'faturamento_'+period,format)

@router.get('/{resource}')
async def listing(resource:str,offset:int=Query(0,ge=0),user:User=Depends(admin),db:Database=Depends(get_database)):
    if resource not in {'products','categories','product_sizes','product_images','orders','profiles','payments','coupons','reviews'}:raise HTTPException(404)
    await _require(user,db,RESOURCE_PERMISSIONS[resource])
    order='created_at.desc' if resource in {'orders','payments','reviews'} else 'id'
    return await db.request('/rest/v1/'+resource,token=user.token,params={'select':'*','order':order,'limit':'100','offset':str(offset)})

@router.post('/products',status_code=201)
async def create_product(body:Product,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'catalog')
    return await db.request('/rest/v1/products',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.put('/products/{product_id}')
async def update_product(product_id:UUID,body:Product,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'catalog')
    return await db.request('/rest/v1/products',method='PATCH',token=user.token,params={'id':'eq.'+str(product_id)},json=body.model_dump(mode='json'))
@router.delete('/products/{product_id}')
async def deactivate_product(product_id:UUID,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'catalog')
    return await db.request('/rest/v1/products',method='PATCH',token=user.token,params={'id':'eq.'+str(product_id)},json={'ativo':False})
@router.post('/sizes',status_code=201)
async def create_size(body:Size,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'catalog')
    return await db.request('/rest/v1/product_sizes',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.put('/sizes/{size_id}')
async def update_size(size_id:UUID,body:Size,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'catalog')
    return await db.request('/rest/v1/product_sizes',method='PATCH',token=user.token,params={'id':'eq.'+str(size_id),'product_id':'eq.'+str(body.product_id)},json={'estoque':body.estoque,'tamanho':body.tamanho})
@router.post('/images',status_code=201)
async def add_image(body:Image,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'catalog')
    return await db.request('/rest/v1/product_images',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.post('/categories',status_code=201)
async def add_category(body:Category,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'catalog')
    return await db.request('/rest/v1/categories',method='POST',token=user.token,json=body.model_dump())

@router.patch('/orders/{order_id}/fulfillment')
async def fulfillment(order_id:UUID,body:Fulfillment,user:User=Depends(admin),db:Database=Depends(get_database)):
    await _require(user,db,'orders')
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
