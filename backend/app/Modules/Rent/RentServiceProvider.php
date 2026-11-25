<?php

declare(strict_types=1);

namespace App\Modules\Rent;

use App\Modules\Rent\Console\GenerateInstallmentsCommand;
use App\Modules\Rent\Models\AdvanceRefund;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\InstallmentLine;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\PaymentAllocation;
use App\Modules\Rent\Models\RentAdjustment;
use App\Modules\Rent\Models\RentNotice;
use App\Modules\Rent\Models\RentReceipt;
use App\Modules\Rent\Models\RentSchedule;
use App\Modules\Rent\Queries\ReminderTargets;
use App\Modules\Rent\Support\IssuerIdentity;
use App\Shared\Reminders\ReminderRegistry;
use App\Shared\Reminders\ReminderWindow;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class RentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(IssuerIdentity::class);
    }

    public function boot(): void
    {
        Relation::enforceMorphMap([
            'rent_schedule' => RentSchedule::class,
            'installment' => Installment::class,
            'installment_line' => InstallmentLine::class,
            'rent_payment' => Payment::class,
            'rent_payment_allocation' => PaymentAllocation::class,
            'rent_notice' => RentNotice::class,
            'rent_receipt' => RentReceipt::class,
            'rent_adjustment' => RentAdjustment::class,
            'rent_advance_refund' => AdvanceRefund::class,
        ]);

        $this->loadViewsFrom(__DIR__.'/Views', 'rent');

        $rappels = $this->app->make(ReminderRegistry::class);
        $rappels->register('rent_due_soon', fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)->dueSoon($fenetre));
        $rappels->register('rent_unpaid', fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)->unpaid($fenetre));

        if ($this->app->runningInConsole()) {
            $this->commands([GenerateInstallmentsCommand::class]);
        }
    }
}
