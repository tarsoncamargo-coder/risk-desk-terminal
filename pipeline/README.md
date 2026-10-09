# Risk Desk J7A Live Pipeline

Esta pasta contém a camada local de aquisição LIVE.

- `RiskDeskLiveBridgeJ7A.cs`: NinjaTrader -> CSV M1 para NQ/ZQ/ZT/ZN.
- O uploader Python é distribuído separadamente nesta etapa e usa uma Supabase Secret Key somente via variável de ambiente local.
- Nenhuma credencial deve ser commitada.
- Nenhuma rotina envia ordens.

## Estado

J7A = foundation ready, aguardando conexão da fonte local.

DXY, evento macro, Sigma live e regime live entram nas próximas subetapas.
