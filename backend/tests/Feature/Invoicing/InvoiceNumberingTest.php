<?php

declare(strict_types=1);

use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('numérote en suite continue FA puis AF, par année', function (): void {
    $premiere = C::emettre($this, $this->org, $this->partie);
    $seconde = C::emettre($this, $this->org, $this->partie);
    $this->postJson(C::url($this->org, "/{$premiere->id}/credit-notes"), ['reason' => 'Erreur', 'full' => true, 'idempotency_key' => 'avoir-numero-1'])->assertCreated()->assertJsonPath('data.number', 'AF-2026-0001');

    $this->travelTo(CarbonImmutable::parse('2027-01-05 09:00:00'));
    $suivante = C::emettre($this, $this->org, $this->partie);

    expect([$premiere->number, $seconde->number, $suivante->number])->toBe(['FA-2026-0001', 'FA-2026-0002', 'FA-2027-0001']);
});

it('un brouillon abandonné ne laisse aucun trou', function (): void {
    $abandonne = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$abandonne}/discard"))->assertOk()->assertJsonPath('data.status', 'discarded');

    expect(C::emettre($this, $this->org, $this->partie)->number)->toBe('FA-2026-0001');
    $this->postJson(C::url($this->org, "/{$abandonne}/issue"))->assertStatus(409)->assertJsonPath('code', 'invoice_not_draft');
});

it('une panne de Gotenberg donne 503 sans écriture ni trou de numérotation', function (): void {
    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');
    C::$panneGotenberg = true;

    $reponse = $this->postJson(C::url($this->org, "/{$id}/issue"))->assertStatus(503)->assertJsonPath('code', 'invoice_pdf_unavailable');

    expect($reponse->headers->get('Retry-After'))->not->toBeNull()
        ->and(DB::table('journal_entries')->count())->toBe(0)
        ->and(DB::table('issued_documents')->count())->toBe(0)
        ->and(DB::table('invoice_sequences')->count())->toBe(0)
        ->and(L::dans($this->org, fn () => Invoice::query()->find($id)->only(['status', 'number'])))->toBe(['status' => InvoiceStatus::Draft, 'number' => null]);

    C::$panneGotenberg = false;
    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated()->assertJsonPath('data.number', 'FA-2026-0001');
});

it('l\'émission d\'une facture déjà émise est rejouée sans second numéro', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    $this->postJson(C::url($this->org, "/{$facture->id}/issue"))->assertOk()->assertJsonPath('data.number', 'FA-2026-0001')->assertJsonPath('data.replayed', true);

    expect(DB::table('invoice_sequences')->value('last_value'))->toBe(1)
        ->and(DB::table('journal_entries')->count())->toBe(1);
});
