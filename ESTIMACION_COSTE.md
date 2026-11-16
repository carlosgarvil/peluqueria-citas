# Estimación de tokens, coste y tiempo de desarrollo

Este proyecto se generó con Claude Code usando el modelo **Claude Opus 5.5** (`claude-opus-5-5`), en una única sesión el 16/11/2026.

> Las cifras son **estimaciones**. El modelo no tiene acceso a su propio contador de uso. La cifra exacta se obtiene con el comando `/cost` de Claude Code en la misma sesión, o en el panel de uso de la consola de Anthropic.

## Tiempo

| Fase | Hora (CET) | Duración |
|---|---|---|
| Preguntas iniciales (stack, ofertas, notificaciones, dataset) | ~17:45 – 17:54 | ~5–10 min, incluida la respuesta del usuario |
| Desarrollo: código, migración, Docker, tests y pruebas e2e en navegador | 17:54 – 18:24 | **~30 min** |
| Primer commit y subida a GitHub | 18:24 – 18:32 | ~5 min |
| **Total** | | **~40 min** |

Las horas salen de las marcas de tiempo de los ficheros y de la fecha del primer commit.

## Tokens

| Concepto | Tokens aprox. | Comentario |
|---|---|---|
| Salida (generados por el modelo) | ~80.000 | Unos 150 KB de código fuente (~45k tokens) más ediciones, scripts de prueba, explicaciones y razonamiento |
| Entrada leída de caché | ~5–6 millones | En cada una de las ~65 llamadas a herramientas se reenvía el contexto, que creció de ~30k a ~180k tokens |
| Entrada escrita en caché | ~250.000 | Contexto nuevo que se añade en cada paso |
| Entrada sin caché | despreciable | |
| **Total procesado** | **~6 millones** | La gran mayoría son lecturas de caché baratas |

## Coste aproximado (precios de API)

Precios de Claude Opus 5.5 por millón de tokens: entrada 4 $, salida 20 $, lectura de caché 0,20 $ y escritura de caché con TTL de 1 h 8 $.

| Concepto | Cálculo | Coste |
|---|---|---|
| Salida | 0,08 M × 20 $ | ~1,60 $ |
| Lectura de caché | ~5,5 M × 0,20 $ | ~1,10 $ |
| Escritura de caché | ~0,25 M × 8 $ | ~2,00 $ |
| **Total** | | **~4,70 $** (rango razonable: 3–6 $) |

Con una suscripción de Claude (Pro o Max) no hay coste por token: el uso se descuenta del cupo del plan. La tabla sirve como referencia de lo que costaría pagando por API.

## Qué incluye ese coste

- Aplicación Next.js + Prisma + PostgreSQL, con ~60 ficheros y ~150 KB de código.
- Despliegue con `docker compose` en dos modos: desarrollo con volúmenes y producción.
- Asistente de primer inicio con un dataset demo opcional.
- 15 tests unitarios (Vitest).
- Pruebas end-to-end hechas por el propio agente en un navegador headless (no forman parte del repositorio).
