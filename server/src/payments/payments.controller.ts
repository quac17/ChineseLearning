import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PayosEnabledGuard } from '../common/feature-flags';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/types/domain.types';
import { AdminOrderActionDto, CheckoutDto } from './dto/payment.dto';
import { InvalidSignatureError } from './gateways/payment-gateway';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(PayosEnabledGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Creates (or reuses) an order for one course and returns its QR. */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthUser) {
    return this.payments.checkout(user, dto.courseId);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: AuthUser) {
    return this.payments.listMine(user);
  }

  /** Polled by the checkout page; reconciles with the gateway when pending. */
  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  getOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.getOrder(user, id);
  }

  /** Dev only (fake gateway): pay the order through the real webhook path. */
  @Post('orders/:id/simulate-paid')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  simulatePaid(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.simulatePaid(user, id);
  }

  /**
   * Public: called by PayOS (no JWT). 400 only for a bad signature; any other
   * outcome is acknowledged with 200 so the gateway stops retrying.
   */
  @Post('webhook/payos')
  @HttpCode(200)
  async webhook(@Body() body: unknown) {
    try {
      const { outcome } = await this.payments.handleWebhook(body);
      return { success: true, outcome };
    } catch (err) {
      if (err instanceof InvalidSignatureError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  // Admin ---------------------------------------------------------------------

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminList(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('courseId') courseId?: string,
    @Query('needsReview') needsReview?: string,
  ) {
    return this.payments.adminList({ q, status, courseId, needsReview: needsReview === 'true' });
  }

  @Get('admin/orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminGet(@Param('id') id: string) {
    return this.payments.adminGet(id);
  }

  @Post('admin/orders/:id/grant')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(200)
  adminGrant(@Param('id') id: string, @Body() dto: AdminOrderActionDto, @CurrentUser() admin: AuthUser) {
    return this.payments.adminGrant(admin, id, dto.note);
  }

  @Post('admin/orders/:id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(200)
  adminRefund(@Param('id') id: string, @Body() dto: AdminOrderActionDto, @CurrentUser() admin: AuthUser) {
    return this.payments.adminRefund(admin, id, dto.note);
  }
}
