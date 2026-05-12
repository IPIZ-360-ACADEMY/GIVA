# Guia: Conectar Domínio AWS ao Projeto Vercel

## Passo 1: Obter os DNS Records da Vercel

1. No dashboard da Vercel, vá para o seu projeto
2. Settings → Domains
3. Adicione seu domínio (ex: `seudominio.com`)
4. A Vercel mostrará os **DNS records** necessários:

```
Tipo: A
Nome: @
Valor: 76.76.21.21

Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
```

## Passo 2: Configurar na AWS Route 53

### 2.1 Acesse o AWS Route 53
- Faça login em [console.aws.amazon.com](https://console.aws.amazon.com)
- Vá para **Route 53** → **Hosted Zones**

### 2.2 Criar/Editar a Hosted Zone
1. Clique no seu domínio
2. **Criar Record**:

#### Opção A - IPv4 (A Record)
```
Record name: @ (ou deixe vazio)
Type: A - IPv4 address
Value: 76.76.21.21
TTL: 300 (ou Auto)
```

#### Opção B - WWW (CNAME)
```
Record name: www
Type: CNAME - Canonical name
Value: cname.vercel-dns.com
TTL: 300 (ou Auto)
```

### 2.3 Verificar Propagação
- DNS pode levar **até 24 horas** (geralmente 5-30 minutos)
- Use: `dig seudominio.com` ou [dnschecker.org](https://dnschecker.org)

## Passo 3: Configurar HTTPS (SSL)

A Vercel gera SSL automaticamente:

1. No dashboard Vercel → **Settings** → **Domains**
2. O domínio deve mostrar **Valid**
3. O SSL é provisionado automaticamente pela Vercel

Se houver erro de SSL:
```bash
# Forçar renewal do certificado
vercel certs renew <cert-id>
```

## Configuração Completa (Exemplo)

### Record Set AWS:
| Name | Type | Value | TTL |
|------|------|-------|-----|
| @ | A | 76.76.21.21 | 300 |
| www | CNAME | cname.vercel-dns.com | 300 |

## Troubleshooting

### Domínio não resolve:
1. Verificar se o domínio está apontando para nameservers corretos da AWS
2. Esperar propagação DNS (até 24h)
3. Verificar erros de digitação

### SSL não funciona:
1. Aguardar ~5 minutos após configuração
2. Verificar se CAA records não estão bloqueando

### Subdomínios não funcionam:
- Criar records separados para cada subdomínio:
  - `app.seudominio.com` → CNAME → cname.vercel-dns.com
  - `api.seudominio.com` → CNAME → cname.vercel-dns.com

## Comandos Úteis

```bash
# Verificar DNS
dig seudominio.com

# Verificar apenas A record
dig seudominio.com A

# Verificar propagation global
nslookup seudominio.com
```

## Links Úteis
- [Vercel Docs - Custom Domains](https://vercel.com/docs/concepts/projects/domains)
- [AWS Route 53 Docs](https://docs.aws.amazon.com/route53/)
- [Vercel CLI - Domains](https://vercel.com/docs/cli/domain)
