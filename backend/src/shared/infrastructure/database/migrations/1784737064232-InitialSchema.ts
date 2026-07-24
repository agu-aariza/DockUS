/**
 * @fileoverview Componente de infraestructura compartida (1784737064232-InitialSchema).
 *
 * @module 1784737064232-InitialSchema
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1784737064232 implements MigrationInterface {
    name = 'InitialSchema1784737064232'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED')`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(200) NOT NULL, "contextAcademico" text, "maxDeliveriesPerStudent" integer NOT NULL DEFAULT '1', "status" "public"."projects_status_enum" NOT NULL DEFAULT 'DRAFT', "expectedType" character varying(100), "rubricInstructions" text, "rubricCriteria" jsonb, "expectedOutput" text, "opensAt" TIMESTAMP, "closesAt" TIMESTAMP, "creatorId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('STUDENT', 'TEACHER', 'ADMIN')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'STUDENT', "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE', "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_enrollments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "studentId" uuid NOT NULL, "enrolledById" uuid NOT NULL, "enrolledAt" TIMESTAMP NOT NULL DEFAULT now(), "revokedAt" TIMESTAMP, CONSTRAINT "PK_0d6111a0d2e5a2923ce0c19b259" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9ab7965ffb8c5941c89981fe84" ON "group_enrollments"  ("groupId", "studentId") WHERE "revokedAt" IS NULL`);
        await queryRunner.query(`CREATE TABLE "course_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "code" character varying(50), "description" text, "createdById" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_9722c03add9ea0dca5c69447398" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "project_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "studentId" uuid NOT NULL, "assignedById" uuid NOT NULL, "assignedAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "sourceGroupIds" uuid array NOT NULL DEFAULT '{}', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_045df8f32ae1d54810b39b9c7bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8a973b5f3d016c344c8dcbe883" ON "project_assignments"  ("projectId", "studentId") `);
        await queryRunner.query(`CREATE TYPE "public"."deliveries_status_enum" AS ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'EVALUATED')`);
        await queryRunner.query(`CREATE TABLE "deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "assignmentId" uuid NOT NULL, "authorId" uuid NOT NULL, "version" integer NOT NULL, "status" "public"."deliveries_status_enum" NOT NULL DEFAULT 'DRAFT', "notes" text, "isLate" boolean NOT NULL DEFAULT false, "grade" numeric(5,2), "graderNotes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_a6ef225c5c5f0974e503bfb731f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_774a237d8422ec146d13613510" ON "deliveries"  ("assignmentId", "version") `);
        await queryRunner.query(`CREATE TYPE "public"."build_run_events_eventtype_enum" AS ENUM('RUN_ENQUEUED', 'RUN_STARTED', 'RUN_STATUS_CHANGED', 'LOG_CHUNK', 'WARNING_ADDED', 'ARTIFACT_ADDED', 'REPORT_READY', 'RUN_COMPLETED', 'RUN_FAILED', 'RUN_CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "build_run_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "buildRunId" uuid NOT NULL, "sequence" BIGSERIAL NOT NULL, "eventType" "public"."build_run_events_eventtype_enum" NOT NULL, "runStatus" character varying(32), "message" text NOT NULL, "payload" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_98f740df2e0cee4c8a48a2965da" UNIQUE ("sequence"), CONSTRAINT "PK_37f481edd51e453d9c2aa43dcee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_build_run_events_run_sequence" ON "build_run_events"  ("buildRunId", "sequence") `);
        await queryRunner.query(`CREATE TYPE "public"."build_runs_status_enum" AS ENUM('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "build_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deliveryId" uuid NOT NULL, "triggeredById" uuid NOT NULL, "status" "public"."build_runs_status_enum" NOT NULL DEFAULT 'QUEUED', "latestEventSequence" bigint, "llmAssessment" jsonb, "codeQualityFindings" jsonb, "llmReasoning" text, "report" jsonb, "failureReason" text, "warnings" text array NOT NULL DEFAULT '{}', "promptVersion" text, "inputTokens" integer NOT NULL DEFAULT '0', "outputTokens" integer NOT NULL DEFAULT '0', "executionCostUsd" numeric(10,6) NOT NULL DEFAULT '0', "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_19fc7ed1933454e2ddf20cfbf52" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_build_runs_delivery_active" ON "build_runs"  ("deliveryId") WHERE "status" IN ('QUEUED','RUNNING')`);
        await queryRunner.query(`CREATE INDEX "IDX_build_runs_status" ON "build_runs"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_build_runs_delivery_created_at" ON "build_runs"  ("deliveryId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."build_run_artifacts_artifacttype_enum" AS ENUM('BUILD_LOG', 'RUNTIME_EVENTS', 'CONTAINER_INSPECT', 'CONTAINER_LOG', 'TEST_LOG', 'REPORT_TEXT', 'REPORT_JSON', 'REPRODUCIBILITY_JSON', 'PREFLIGHT', 'CLASSIFICATION', 'STRATEGY', 'STATIC_FINDINGS', 'STATIC_REVIEW', 'SELF_HEALING_TRACE', 'LLM_PLAN_PROMPT', 'LLM_PLAN_RAW_RESPONSE', 'LLM_FACTS_PROMPT', 'LLM_FACTS_RAW_RESPONSE', 'LLM_FACTS_PARSED', 'LLM_FACTS_ERROR', 'LLM_PLAN_PARSED', 'LLM_PLAN_ERROR', 'LLM_EVAL_PROMPT', 'LLM_EVAL_RAW_RESPONSE', 'LLM_EVAL_PARSED', 'LLM_EVAL_ERROR', 'LLM_QUALITY_PROMPT', 'LLM_QUALITY_RAW_RESPONSE', 'LLM_QUALITY_PARSED', 'LLM_QUALITY_ERROR')`);
        await queryRunner.query(`CREATE TABLE "build_run_artifacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "buildRunId" uuid NOT NULL, "artifactType" "public"."build_run_artifacts_artifacttype_enum" NOT NULL, "bucket" character varying(255) NOT NULL, "objectKey" character varying(1024) NOT NULL, "contentType" character varying(255) NOT NULL, "sizeBytes" integer NOT NULL, "sha256" character varying(64) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4b5aa1fa1ae29b0ffb7855dc42c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_build_run_artifacts_build_run_created_at" ON "build_run_artifacts"  ("buildRunId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "build_run_chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "buildRunId" uuid NOT NULL, "sender" character varying(16) NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3adebd99d1d95a1708a9e2b9099" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_build_run_chat_messages_run_created_at" ON "build_run_chat_messages"  ("buildRunId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "code_quality_findings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "buildRunId" uuid NOT NULL, "projectId" uuid NOT NULL, "studentId" uuid NOT NULL, "category" character varying(32) NOT NULL, "title" character varying(255) NOT NULL, "detail" text NOT NULL, "severity" character varying(16) NOT NULL, "file" character varying(512), "line" integer, "codeSnippet" text NOT NULL DEFAULT '', "level" character varying(16) NOT NULL DEFAULT 'basico', "conceptExplanation" text NOT NULL DEFAULT '', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c76fb17c44d5c53e7f491e4607a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_code_quality_findings_project_student" ON "code_quality_findings"  ("projectId", "studentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_code_quality_findings_project_title" ON "code_quality_findings"  ("projectId", "title") `);
        await queryRunner.query(`CREATE TABLE "llm_configurations" ("providerId" character varying(50) NOT NULL, "apiKeyEncrypted" text, "apiKeyLast4" character varying(8), "awsAccessKeyId" text, "endpoint" text, "region" text, "modelVersion" text, "modelId" text NOT NULL, "temperature" double precision NOT NULL DEFAULT '0.2', "maxTokens" integer NOT NULL DEFAULT '4000', "inputCostPerMillion" numeric(10,4) NOT NULL DEFAULT '0', "outputCostPerMillion" numeric(10,4) NOT NULL DEFAULT '0', "assignedRoles" text array NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ae7a20a14f11097a0c23cd65d02" PRIMARY KEY ("providerId"))`);
        await queryRunner.query(`CREATE TYPE "public"."storage_objects_assetrole_enum" AS ENUM('STUDENT_SOURCE', 'TEACHER_TESTS')`);
        await queryRunner.query(`CREATE TABLE "storage_objects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "assetRole" "public"."storage_objects_assetrole_enum" NOT NULL, "projectId" uuid, "deliveryId" uuid, "logicalName" character varying(255) NOT NULL, "logicalPath" character varying(1024) NOT NULL, "contentType" character varying(255) NOT NULL, "sizeBytes" integer NOT NULL, "hash" character varying(128) NOT NULL, "bucket" character varying(255) NOT NULL, "objectKey" character varying(1024) NOT NULL, "uploaderId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_c35194bd3fa07c4733c0fd55fda" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_storage_objects_scope" ON "storage_objects"  ("projectId", "deliveryId", "assetRole", "logicalPath") `);
        await queryRunner.query(`CREATE TABLE "project_teachers" ("projectId" uuid NOT NULL, "teacherId" uuid NOT NULL, CONSTRAINT "PK_a57a170e9f5329d6011a00e8ac6" PRIMARY KEY ("projectId", "teacherId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8d38735f1f9ef4ac462c84d387" ON "project_teachers"  ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f44e6f892d659508950abd4874" ON "project_teachers"  ("teacherId") `);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_1beb66d6bdd694692f8eb9881b4" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_enrollments" ADD CONSTRAINT "FK_2cf84638c673e7606910d88a81e" FOREIGN KEY ("groupId") REFERENCES "course_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_enrollments" ADD CONSTRAINT "FK_de435374649d3666c36c3adae46" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_enrollments" ADD CONSTRAINT "FK_42dbfbacb93d8447fba081dba3c" FOREIGN KEY ("enrolledById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "course_groups" ADD CONSTRAINT "FK_a05a11fbbdc96cebda31e077008" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_assignments" ADD CONSTRAINT "FK_9c5f0cbd89c4d1e858a4b4a4e4f" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_assignments" ADD CONSTRAINT "FK_193b09ec5363783f970486eb434" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_assignments" ADD CONSTRAINT "FK_7937d8818c0019a7c8325db1141" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deliveries" ADD CONSTRAINT "FK_d3da6b0eb388b897daaa2507ad0" FOREIGN KEY ("assignmentId") REFERENCES "project_assignments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deliveries" ADD CONSTRAINT "FK_153a9fc456ce46b52c9562b16c9" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "build_run_events" ADD CONSTRAINT "FK_bd91b8c890292bd419156180aeb" FOREIGN KEY ("buildRunId") REFERENCES "build_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "build_runs" ADD CONSTRAINT "FK_a447f1180fdd5750ce36dd14097" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "build_runs" ADD CONSTRAINT "FK_c32109ba38cc4cb4307d4e401a3" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "build_run_artifacts" ADD CONSTRAINT "FK_28e278f9fc332bb4581cb28b592" FOREIGN KEY ("buildRunId") REFERENCES "build_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "build_run_chat_messages" ADD CONSTRAINT "FK_ec4e964841a32681b181eb4a8c6" FOREIGN KEY ("buildRunId") REFERENCES "build_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "code_quality_findings" ADD CONSTRAINT "FK_51ff02ca9f0a6f3ef238c3203ec" FOREIGN KEY ("buildRunId") REFERENCES "build_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "storage_objects" ADD CONSTRAINT "FK_5ba27fa91724217934422c71dd4" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "storage_objects" ADD CONSTRAINT "FK_75e6375f4dacd4a9538671ebf0c" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "storage_objects" ADD CONSTRAINT "FK_04389d073f3a9122b35caf3a9a9" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_teachers" ADD CONSTRAINT "FK_8d38735f1f9ef4ac462c84d3878" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "project_teachers" ADD CONSTRAINT "FK_f44e6f892d659508950abd48746" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_teachers" DROP CONSTRAINT "FK_f44e6f892d659508950abd48746"`);
        await queryRunner.query(`ALTER TABLE "project_teachers" DROP CONSTRAINT "FK_8d38735f1f9ef4ac462c84d3878"`);
        await queryRunner.query(`ALTER TABLE "storage_objects" DROP CONSTRAINT "FK_04389d073f3a9122b35caf3a9a9"`);
        await queryRunner.query(`ALTER TABLE "storage_objects" DROP CONSTRAINT "FK_75e6375f4dacd4a9538671ebf0c"`);
        await queryRunner.query(`ALTER TABLE "storage_objects" DROP CONSTRAINT "FK_5ba27fa91724217934422c71dd4"`);
        await queryRunner.query(`ALTER TABLE "code_quality_findings" DROP CONSTRAINT "FK_51ff02ca9f0a6f3ef238c3203ec"`);
        await queryRunner.query(`ALTER TABLE "build_run_chat_messages" DROP CONSTRAINT "FK_ec4e964841a32681b181eb4a8c6"`);
        await queryRunner.query(`ALTER TABLE "build_run_artifacts" DROP CONSTRAINT "FK_28e278f9fc332bb4581cb28b592"`);
        await queryRunner.query(`ALTER TABLE "build_runs" DROP CONSTRAINT "FK_c32109ba38cc4cb4307d4e401a3"`);
        await queryRunner.query(`ALTER TABLE "build_runs" DROP CONSTRAINT "FK_a447f1180fdd5750ce36dd14097"`);
        await queryRunner.query(`ALTER TABLE "build_run_events" DROP CONSTRAINT "FK_bd91b8c890292bd419156180aeb"`);
        await queryRunner.query(`ALTER TABLE "deliveries" DROP CONSTRAINT "FK_153a9fc456ce46b52c9562b16c9"`);
        await queryRunner.query(`ALTER TABLE "deliveries" DROP CONSTRAINT "FK_d3da6b0eb388b897daaa2507ad0"`);
        await queryRunner.query(`ALTER TABLE "project_assignments" DROP CONSTRAINT "FK_7937d8818c0019a7c8325db1141"`);
        await queryRunner.query(`ALTER TABLE "project_assignments" DROP CONSTRAINT "FK_193b09ec5363783f970486eb434"`);
        await queryRunner.query(`ALTER TABLE "project_assignments" DROP CONSTRAINT "FK_9c5f0cbd89c4d1e858a4b4a4e4f"`);
        await queryRunner.query(`ALTER TABLE "course_groups" DROP CONSTRAINT "FK_a05a11fbbdc96cebda31e077008"`);
        await queryRunner.query(`ALTER TABLE "group_enrollments" DROP CONSTRAINT "FK_42dbfbacb93d8447fba081dba3c"`);
        await queryRunner.query(`ALTER TABLE "group_enrollments" DROP CONSTRAINT "FK_de435374649d3666c36c3adae46"`);
        await queryRunner.query(`ALTER TABLE "group_enrollments" DROP CONSTRAINT "FK_2cf84638c673e7606910d88a81e"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_1beb66d6bdd694692f8eb9881b4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f44e6f892d659508950abd4874"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d38735f1f9ef4ac462c84d387"`);
        await queryRunner.query(`DROP TABLE "project_teachers"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_storage_objects_scope"`);
        await queryRunner.query(`DROP TABLE "storage_objects"`);
        await queryRunner.query(`DROP TYPE "public"."storage_objects_assetrole_enum"`);
        await queryRunner.query(`DROP TABLE "llm_configurations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_code_quality_findings_project_title"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_code_quality_findings_project_student"`);
        await queryRunner.query(`DROP TABLE "code_quality_findings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_build_run_chat_messages_run_created_at"`);
        await queryRunner.query(`DROP TABLE "build_run_chat_messages"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_build_run_artifacts_build_run_created_at"`);
        await queryRunner.query(`DROP TABLE "build_run_artifacts"`);
        await queryRunner.query(`DROP TYPE "public"."build_run_artifacts_artifacttype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_build_runs_delivery_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_build_runs_status"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_build_runs_delivery_active"`);
        await queryRunner.query(`DROP TABLE "build_runs"`);
        await queryRunner.query(`DROP TYPE "public"."build_runs_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_build_run_events_run_sequence"`);
        await queryRunner.query(`DROP TABLE "build_run_events"`);
        await queryRunner.query(`DROP TYPE "public"."build_run_events_eventtype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_774a237d8422ec146d13613510"`);
        await queryRunner.query(`DROP TABLE "deliveries"`);
        await queryRunner.query(`DROP TYPE "public"."deliveries_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a973b5f3d016c344c8dcbe883"`);
        await queryRunner.query(`DROP TABLE "project_assignments"`);
        await queryRunner.query(`DROP TABLE "course_groups"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ab7965ffb8c5941c89981fe84"`);
        await queryRunner.query(`DROP TABLE "group_enrollments"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
    }

}
