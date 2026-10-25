CREATE OR REPLACE FUNCTION public.horizon_admin_create_product(
    p_product jsonb,
    p_image_url text,
    p_sizes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
    v_product public.products%ROWTYPE;
BEGIN
    IF p_product IS NULL OR pg_catalog.jsonb_typeof(p_product) <> 'object' THEN
        RAISE EXCEPTION 'Invalid product data' USING ERRCODE = '22023';
    END IF;

    IF p_image_url IS NULL OR p_image_url !~ '^https://' OR pg_catalog.length(p_image_url) > 2048 THEN
        RAISE EXCEPTION 'Invalid product image URL' USING ERRCODE = '22023';
    END IF;

    IF p_sizes IS NULL OR pg_catalog.jsonb_typeof(p_sizes) <> 'array'
       OR pg_catalog.jsonb_array_length(p_sizes) < 1
       OR pg_catalog.jsonb_array_length(p_sizes) > 12 THEN
        RAISE EXCEPTION 'Provide between 1 and 12 product sizes' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_sizes) AS item(value)
        WHERE pg_catalog.jsonb_typeof(item.value) <> 'object'
           OR NULLIF(pg_catalog.btrim(item.value ->> 'tamanho'), '') IS NULL
           OR pg_catalog.length(pg_catalog.btrim(item.value ->> 'tamanho')) > 20
           OR COALESCE(item.value ->> 'estoque', '') !~ '^[0-9]{1,6}$'
           OR (item.value ->> 'estoque')::integer > 100000
    ) THEN
        RAISE EXCEPTION 'Invalid size or stock value' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_sizes) AS item(value)
        GROUP BY pg_catalog.upper(pg_catalog.btrim(item.value ->> 'tamanho'))
        HAVING pg_catalog.count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate product size' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.products (
        nome, slug, categoria_id, descricao, tecido, caimento,
        preco, preco_promocional, ativo, destaque, lancamento
    ) VALUES (
        p_product ->> 'nome',
        p_product ->> 'slug',
        (p_product ->> 'categoria_id')::uuid,
        COALESCE(p_product ->> 'descricao', ''),
        NULLIF(p_product ->> 'tecido', ''),
        NULLIF(p_product ->> 'caimento', ''),
        (p_product ->> 'preco')::numeric,
        NULLIF(p_product ->> 'preco_promocional', '')::numeric,
        COALESCE((p_product ->> 'ativo')::boolean, false),
        COALESCE((p_product ->> 'destaque')::boolean, false),
        COALESCE((p_product ->> 'lancamento')::boolean, false)
    )
    RETURNING * INTO v_product;

    INSERT INTO public.product_images (product_id, url, ordem)
    VALUES (v_product.id, p_image_url, 0);

    INSERT INTO public.product_sizes (product_id, tamanho, estoque)
    SELECT
        v_product.id,
        pg_catalog.upper(pg_catalog.btrim(item.value ->> 'tamanho')),
        (item.value ->> 'estoque')::integer
    FROM pg_catalog.jsonb_array_elements(p_sizes) AS item(value);

    RETURN pg_catalog.to_jsonb(v_product);
END;
$function$;

REVOKE ALL ON FUNCTION public.horizon_admin_create_product(jsonb, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.horizon_admin_create_product(jsonb, text, jsonb) TO authenticated;