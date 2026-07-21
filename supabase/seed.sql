-- BodySplashers — Seed inicial de produtos
-- Execute após schema.sql

insert into products (slug, name, short_description, description, price, old_price, category, tag, notes, sizes, images, rating, review_count, stock, active)
values
  (
    'midnight-rush',
    'Midnight Rush',
    'Aroma quente e magnético para a noite.',
    'Um body splash intenso e envolvente, com notas de baunilha cremosa, âmbar e sândalo. Fixação prolongada para quem quer marcar presença.',
    89.90, 119.90, 'Amadeirado', 'Mais Vendido',
    '{Baunilha,Âmbar,Sândalo}',
    '{100ml,200ml}',
    '{https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=900&q=80}',
    4.9, 312, 50, true
  ),
  (
    'neon-bloom',
    'Neon Bloom',
    'Floral vibrante com toque elétrico.',
    'Frescor floral moderno, com peônia, jasmim e um fundo de musk branco. Leve, jovem e marcante o dia todo.',
    74.90, null, 'Floral', 'Lançamento',
    '{Peônia,Jasmim,"Musk Branco"}',
    '{100ml,200ml}',
    '{https://images.unsplash.com/photo-1588405748880-12d1d2a59d75?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=900&q=80}',
    4.8, 184, 38, true
  ),
  (
    'tropic-glow',
    'Tropic Glow',
    'Verão na pele, do dia à noite.',
    'Frutado solar e adocicado, com maracujá, coco e pêssego maduro. Perfeito para climas quentes.',
    69.90, 89.90, 'Frutal', 'Frete Grátis',
    '{Maracujá,Coco,Pêssego}',
    '{100ml,200ml}',
    '{https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=900&q=80}',
    4.7, 256, 45, true
  ),
  (
    'ice-vapor',
    'Ice Vapor',
    'Refrescância gelada com toque amadeirado.',
    'Sensação de frescor instantâneo, com menta crocante, limão siciliano e cedro suave. Ideal pós-banho.',
    79.90, null, 'Fresco', null,
    '{Menta,"Limão Siciliano",Cedro}',
    '{100ml,200ml}',
    '{https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1517141928534-fbb1d9d96e25?auto=format&fit=crop&w=900&q=80}',
    4.6, 98, 22, true
  ),
  (
    'velvet-noir',
    'Velvet Noir',
    'Sedutor, misterioso, inesquecível.',
    'Composição oriental sofisticada com rosa negra, patchouli e um leve toque de couro. Para ocasiões especiais.',
    99.90, 129.90, 'Oriental', 'Mais Vendido',
    '{"Rosa Negra",Patchouli,Couro}',
    '{100ml,200ml}',
    '{https://images.unsplash.com/photo-1557170334-a9086d51c3c1?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1610461888750-10bfc601b874?auto=format&fit=crop&w=900&q=80}',
    5.0, 421, 15, true
  ),
  (
    'sunset-haze',
    'Sunset Haze',
    'Luz dourada em forma de aroma.',
    'Cítrico solar com bergamota e tangerina, finalizando em almíscar quente. Despertador para os sentidos.',
    64.90, null, 'Cítrico', 'Lançamento',
    '{Bergamota,Tangerina,Almíscar}',
    '{100ml,200ml}',
    '{https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1592842232655-e5d345cbc2c1?auto=format&fit=crop&w=900&q=80}',
    4.7, 142, 33, true
  )
on conflict (slug) do nothing;
