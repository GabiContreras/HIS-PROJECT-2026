import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1790809073528 implements MigrationInterface {
    name = 'InitSchema1790809073528'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."usuarios_rol_enum" AS ENUM('MEDICO', 'ENFERMERO', 'ADMINISTRATIVO')`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying NOT NULL, "apellido" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "rol" "public"."usuarios_rol_enum" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pacientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying NOT NULL, "apellido" character varying NOT NULL, "documento" character varying NOT NULL, "fechaNacimiento" date NOT NULL, "telefono" character varying, CONSTRAINT "UQ_33ca77b5c51990d84f5f1dc07d4" UNIQUE ("documento"), CONSTRAINT "PK_aa9c9f624ff22fc06c44d8b1609" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."turnos_estado_enum" AS ENUM('DISPONIBLE', 'RESERVADO', 'CONFIRMADO', 'ATENDIDO', 'CANCELADO')`);
        await queryRunner.query(`CREATE TABLE "turnos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fechaHora" TIMESTAMP WITH TIME ZONE NOT NULL, "estado" "public"."turnos_estado_enum" NOT NULL DEFAULT 'DISPONIBLE', "version" integer NOT NULL, "pacienteId" uuid, "medicoId" uuid, CONSTRAINT "PK_61dbaea0fc136ee2ef981f14782" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."camas_estado_enum" AS ENUM('DISPONIBLE', 'OCUPADA', 'RESERVADA', 'MANTENIMIENTO')`);
        await queryRunner.query(`CREATE TABLE "camas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "numero" character varying NOT NULL, "sector" character varying, "estado" "public"."camas_estado_enum" NOT NULL DEFAULT 'DISPONIBLE', "version" integer NOT NULL, "pacienteActualId" uuid, CONSTRAINT "UQ_62cb09cb7b1002769cda8d493bb" UNIQUE ("numero"), CONSTRAINT "PK_ed42a5b14d01cafe0bc74dfd552" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "insumos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying NOT NULL, "unidadMedida" character varying NOT NULL, "cantidadDisponible" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_0d28ae68a8f742beb176aa51ae0" UNIQUE ("nombre"), CONSTRAINT "PK_b4e1b727a7b140e698e3a3dc7af" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "signos_vitales" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" character varying NOT NULL, "valor" double precision NOT NULL, "fechaHora" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "pacienteId" uuid, "registradoPorId" uuid, CONSTRAINT "PK_9393417075680a1eeaa4a3e5e24" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "indicaciones_medicas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dosis" character varying NOT NULL, "frecuencia" character varying NOT NULL, "fechaInicio" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaFin" TIMESTAMP WITH TIME ZONE, "pacienteId" uuid, "medicoId" uuid, "insumoId" uuid, CONSTRAINT "PK_c341261374969d1b855aaa24089" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "administraciones_medicacion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fechaHoraAdministracion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "observaciones" character varying, "indicacionId" uuid, "enfermeroId" uuid, CONSTRAINT "PK_2202147af1e77e41b10f281b292" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "turnos" ADD CONSTRAINT "FK_08c6611c09da3f3de6e60f017e4" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "turnos" ADD CONSTRAINT "FK_dfa7f1f5c92a719d5a3bff4e596" FOREIGN KEY ("medicoId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "camas" ADD CONSTRAINT "FK_cd173f195169976be3429d0522e" FOREIGN KEY ("pacienteActualId") REFERENCES "pacientes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "signos_vitales" ADD CONSTRAINT "FK_d257ee4b5b2808b80f9a82a1413" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "signos_vitales" ADD CONSTRAINT "FK_d0d7d6561b48421781c5905eb4c" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "indicaciones_medicas" ADD CONSTRAINT "FK_5480b63776fb068d0b2dc7f8224" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "indicaciones_medicas" ADD CONSTRAINT "FK_ea684cbae1e724f826a9300d051" FOREIGN KEY ("medicoId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "indicaciones_medicas" ADD CONSTRAINT "FK_3de9879c81cab4548722a6080e4" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "administraciones_medicacion" ADD CONSTRAINT "FK_4f61dcd64352eb4fa37bf9dac57" FOREIGN KEY ("indicacionId") REFERENCES "indicaciones_medicas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "administraciones_medicacion" ADD CONSTRAINT "FK_79ee1b0f8e44349c5c1f52e240b" FOREIGN KEY ("enfermeroId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "administraciones_medicacion" DROP CONSTRAINT "FK_79ee1b0f8e44349c5c1f52e240b"`);
        await queryRunner.query(`ALTER TABLE "administraciones_medicacion" DROP CONSTRAINT "FK_4f61dcd64352eb4fa37bf9dac57"`);
        await queryRunner.query(`ALTER TABLE "indicaciones_medicas" DROP CONSTRAINT "FK_3de9879c81cab4548722a6080e4"`);
        await queryRunner.query(`ALTER TABLE "indicaciones_medicas" DROP CONSTRAINT "FK_ea684cbae1e724f826a9300d051"`);
        await queryRunner.query(`ALTER TABLE "indicaciones_medicas" DROP CONSTRAINT "FK_5480b63776fb068d0b2dc7f8224"`);
        await queryRunner.query(`ALTER TABLE "signos_vitales" DROP CONSTRAINT "FK_d0d7d6561b48421781c5905eb4c"`);
        await queryRunner.query(`ALTER TABLE "signos_vitales" DROP CONSTRAINT "FK_d257ee4b5b2808b80f9a82a1413"`);
        await queryRunner.query(`ALTER TABLE "camas" DROP CONSTRAINT "FK_cd173f195169976be3429d0522e"`);
        await queryRunner.query(`ALTER TABLE "turnos" DROP CONSTRAINT "FK_dfa7f1f5c92a719d5a3bff4e596"`);
        await queryRunner.query(`ALTER TABLE "turnos" DROP CONSTRAINT "FK_08c6611c09da3f3de6e60f017e4"`);
        await queryRunner.query(`DROP TABLE "administraciones_medicacion"`);
        await queryRunner.query(`DROP TABLE "indicaciones_medicas"`);
        await queryRunner.query(`DROP TABLE "signos_vitales"`);
        await queryRunner.query(`DROP TABLE "insumos"`);
        await queryRunner.query(`DROP TABLE "camas"`);
        await queryRunner.query(`DROP TYPE "public"."camas_estado_enum"`);
        await queryRunner.query(`DROP TABLE "turnos"`);
        await queryRunner.query(`DROP TYPE "public"."turnos_estado_enum"`);
        await queryRunner.query(`DROP TABLE "pacientes"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TYPE "public"."usuarios_rol_enum"`);
    }

}
