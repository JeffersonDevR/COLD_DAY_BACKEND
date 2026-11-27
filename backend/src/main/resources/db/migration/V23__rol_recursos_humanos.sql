-- Rol interno RECURSOS_HUMANOS (audita la documentación de técnicos y proveedores).
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_rol_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_rol_check
    CHECK (rol::text = ANY (ARRAY['CLIENTE', 'TECNICO', 'ADMINISTRADOR', 'CONTABLE', 'PROVEEDOR',
                                  'RECURSOS_HUMANOS']::text[]));
