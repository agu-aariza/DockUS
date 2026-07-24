/**
 * @fileoverview Módulo raíz del worker de procesamiento en segundo plano (ARQ-006).
 *
 * Contexto:
 * - Sustituye a `AppWorkerModule` (que importaba `AppModule` entero, incluido
 *   `HealthModule`, sin motivo funcional). Compone `CoreModule` + el
 *   processor de BullMQ + la señal `PROCESS_ROLE = 'worker'`, que
 *   `BuilderStaleRunRecoveryService`, `BuilderImageRetentionService` y
 *   `BuilderModule.onModuleInit` consultan para saber si deben disparar el
 *   barrido de runs huérfanos y la poda de imágenes — antes lo hacían
 *   comprobando `process.env.DOCKUS_ROLE`, un global implícito que ninguna
 *   parte del sistema de módulos declaraba.
 *
 * `BuilderModule` se importa además de `CoreModule` aunque este ya lo arrastra
 * por la cadena `CoreModule -> ProjectsModule -> BuilderModule`: en NestJS la
 * visibilidad de proveedores no es transitiva sin que cada módulo intermedio
 * lo re-exporte, y no lo hacen. Nest cachea los módulos por referencia, así
 * que este import reutiliza el mismo singleton que ya crea `ProjectsModule`,
 * no duplica instancias ni conexiones.
 *
 * @module WorkerModule
 */

import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { BuilderModule } from './modules/projects/builder/builder.module';
import { BuilderProcessor } from './modules/projects/builder/presentation/builder.processor';
import { ProcessRoleModule } from './process-role.module';

@Module({
  imports: [ProcessRoleModule.forRoot('worker'), CoreModule, BuilderModule],
  providers: [BuilderProcessor],
})
export class WorkerModule {}
