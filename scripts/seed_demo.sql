-- Seed demo (empresa + usuário login + créditos + candidatos com CEP/coordenadas)
-- Idempotente: re-rodar atualiza (inclusive adiciona CEP/lat/lon a quem já existe).
INSERT INTO companies(nome,email,plan,status) VALUES('Acme Talent (Demo)','demo@empresa.com','growth','ativa')
  ON CONFLICT (email) DO NOTHING;
INSERT INTO company_users(company_id,nome,email,password_hash,role)
  SELECT id,'Recrutador Demo','demo@empresa.com','83d1e9f4dcb713895c2bf32cb82e323b:eb4ad2c3de3b71f29828e11eb2fb9c9890ca734c0956f4fac8209fdb9cf62e13','owner' FROM companies WHERE email='demo@empresa.com'
  ON CONFLICT (email) DO NOTHING;
INSERT INTO credit_ledger(company_id,delta,reason,balance_after)
  SELECT c.id,20,'bonus',20 FROM companies c WHERE c.email='demo@empresa.com'
   AND NOT EXISTS (SELECT 1 FROM credit_ledger cl WHERE cl.company_id=c.id);

INSERT INTO candidates(nome,email,telefone,cidade,cep,lat,lon,cargo,area,senioridade,experiencia,escolaridade,work_model,availability,salary_min,salary_max,skills,idiomas,arquetipo,b2b_consent,b2b_consent_at,visibility,last_confirmed_at,email_verified,phone_verified,public_token,confirm_token,status,source,invites_total,responses_received) VALUES
('Ana Souza','ana.souza@ex.dev','11999990001','São Paulo','01310100',-23.5614,-46.6559,'Desenvolvedora Pleno','Tecnologia','pleno','4 anos','Ensino Superior','remoto','imediata',7000,9000,'["React","Node","AWS","TypeScript"]','["Inglês avançado"]','Arquiteto de Possibilidades',true,now(),'visible',now() - interval '3 days',true,true,encode(gen_random_bytes(16),'hex'),encode(gen_random_bytes(16),'hex'),'novo','seed',3,3),
('Bruno Lima','bruno.lima@ex.dev','21999990002','Rio de Janeiro','20040002',-22.9035,-43.1759,'Analista de Dados Sênior','Dados','senior','7 anos','Pós-graduação','hibrido','30d',9000,12000,'["SQL","Python","Power BI","dbt"]','["Inglês intermediário"]','Arquiteto de Possibilidades',true,now(),'visible',now() - interval '10 days',true,false,encode(gen_random_bytes(16),'hex'),encode(gen_random_bytes(16),'hex'),'novo','seed',2,1),
('Carla Dias','carla.dias@ex.dev','31999990003','Belo Horizonte','30130100',-19.9245,-43.9352,'Product Manager','Produto','pleno','5 anos','Ensino Superior','presencial','imediata',8000,11000,'["Discovery","Roadmap","Analytics","Figma"]','["Inglês fluente"]','Arquiteto de Possibilidades',true,now(),'visible',now() - interval '1 days',true,true,encode(gen_random_bytes(16),'hex'),encode(gen_random_bytes(16),'hex'),'novo','seed',5,4),
('Diego Alves','diego.alves@ex.dev','41999990004','Curitiba','80010000',-25.4284,-49.2733,'Designer UX','Design','pleno','3 anos','Ensino Superior','hibrido','60d',6000,8000,'["Figma","UX Research","Design System"]','["Inglês intermediário"]','Arquiteto de Possibilidades',true,now(),'visible',now() - interval '20 days',true,true,encode(gen_random_bytes(16),'hex'),encode(gen_random_bytes(16),'hex'),'novo','seed',1,1),
('Elaine Rocha','elaine.rocha@ex.dev','11999990005','São Paulo','04001000',-23.5890,-46.6380,'Engenheira Backend Sênior','Tecnologia','senior','8 anos','Ensino Superior','presencial','imediata',10000,14000,'["Go","PostgreSQL","Docker","AWS"]','["Inglês avançado"]','Arquiteto de Possibilidades',true,now(),'visible',now() - interval '5 days',true,true,encode(gen_random_bytes(16),'hex'),encode(gen_random_bytes(16),'hex'),'novo','seed',4,4),
('Felipe Gomes','felipe.gomes@ex.dev','11999990006','São Paulo','01001000',-23.5505,-46.6333,'SDR / Vendas','Vendas','junior','2 anos','Ensino Superior','presencial','imediata',3000,4500,'["SDR","CRM","Inbound","Negociação"]','["Inglês básico"]','Arquiteto de Possibilidades',true,now(),'visible',now() - interval '2 days',true,true,encode(gen_random_bytes(16),'hex'),encode(gen_random_bytes(16),'hex'),'novo','seed',2,2)
ON CONFLICT (email) DO UPDATE SET
  cep=EXCLUDED.cep, lat=EXCLUDED.lat, lon=EXCLUDED.lon, cidade=EXCLUDED.cidade,
  skills=EXCLUDED.skills, idiomas=EXCLUDED.idiomas, work_model=EXCLUDED.work_model,
  salary_min=EXCLUDED.salary_min, salary_max=EXCLUDED.salary_max, b2b_consent=true,
  visibility='visible', last_confirmed_at=EXCLUDED.last_confirmed_at, updated_at=now();
