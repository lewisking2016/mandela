import { Module } from "@nestjs/common";
import { ProvisionerController } from "./provisioner/provisioner.controller.js";
import { WebController } from "./web/web.controller.js";

/**
 * Mandela API — v1. Provisioner + Web data module (cookies, no express
 * cookie-parser needed: the web controller parses its own session cookie).
 */
@Module({
  controllers: [ProvisionerController, WebController],
})
export class AppModule {}
