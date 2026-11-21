<?php

declare(strict_types=1);

use App\Modules\Invoicing\Events\InvoiceOverdue;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('signale une seule fois chaque facture échue et non soldée', function (): void {
    Event::fake([InvoiceOverdue::class]);
    $echue = $this->postJson(C::url($this->org), C::brouillon($this->partie, null, ['due_on' => '2026-11-20']))->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$echue}/issue"))->assertCreated();
    $soldee = $this->postJson(C::url($this->org), C::brouillon($this->partie, null, ['due_on' => '2026-11-20']))->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$soldee}/issue"))->assertCreated();
    $this->postJson(C::url($this->org, "/{$soldee}/payments"), ['amount' => 12000, 'method' => 'transfer', 'paid_on' => '2026-11-18', 'idempotency_key' => 'solde-retard-1'])->assertCreated();
    $future = $this->postJson(C::url($this->org), C::brouillon($this->partie, null, ['due_on' => '2026-12-31']))->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$future}/issue"))->assertCreated();

    $this->artisan('invoices:flag-overdue')->assertSuccessful();
    Event::assertNotDispatched(InvoiceOverdue::class);

    $this->travelTo(CarbonImmutable::parse('2026-11-25 08:00:00'));
    $this->artisan('invoices:flag-overdue')->expectsOutputToContain('1 facture(s) échue(s) signalée(s)')->assertSuccessful();
    $this->artisan('invoices:flag-overdue')->expectsOutputToContain('0 facture(s) échue(s) signalée(s)')->assertSuccessful();

    Event::assertDispatchedTimes(InvoiceOverdue::class, 1);
    Event::assertDispatched(InvoiceOverdue::class, fn (InvoiceOverdue $e): bool => $e->invoiceId === $echue && $e->organizationId === $this->org->id && $e->dueOn === '2026-11-20' && $e->leaseId === null);
});

it('la commande est planifiée chaque jour', function (): void {
    $taches = collect(app(Schedule::class)->events())->filter(fn ($e): bool => str_contains((string) $e->command, 'invoices:flag-overdue'));

    expect($taches)->toHaveCount(1)->and($taches->first()->expression)->toMatch('/^\d+ \d+ \* \* \*$/');
});
