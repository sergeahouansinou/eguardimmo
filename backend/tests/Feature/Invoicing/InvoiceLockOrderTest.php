<?php

declare(strict_types=1);

use App\Modules\Invoicing\Actions\CancelInvoicePayment;
use App\Modules\Invoicing\Actions\DiscardDraft;
use App\Modules\Invoicing\Actions\IssueCreditNote;
use App\Modules\Invoicing\Actions\IssueInvoice;
use App\Modules\Invoicing\Actions\RecordInvoicePayment;
use App\Modules\Invoicing\Actions\SendInvoice;
use App\Modules\Invoicing\Actions\UpdateDraft;
use App\Modules\Invoicing\Data\CreditNoteData;
use App\Modules\Invoicing\Data\DraftData;
use App\Modules\Invoicing\Data\NewLineData;
use App\Modules\Invoicing\Data\NewPaymentData;
use App\Modules\Invoicing\Enums\PaymentMethod;
use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Models\InvoicePayment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesQueryTrace as Q;

/*
 * Sous REPEATABLE READ (MySQL), la première lecture non verrouillante d'une transaction fige l'instantané : le reste dû,
 * lu après le verrou, ne verrait pas un règlement validé entre-temps. Chaque Action qui décide d'un statut ou d'un
 * montant prend donc, en tout premier dans sa transaction, la ligne `invoices` FOR UPDATE (la facture d'origine pour un
 * avoir). La preuve réelle exige MySQL 8.4 à deux connexions ; ici l'ordre des requêtes.
 */
beforeEach(function (): void {
    C::preparer($this);
    Mail::fake();
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
    $this->today = CarbonImmutable::parse(C::AUJOURDHUI)->startOfDay();
    $this->verifier = function (callable $appel): void {
        $ordre = Q::run(fn () => L::dans($this->org, $appel));
        $debut = array_search(Q::BEGIN, array_map(fn (array $e): string => $e[0], $ordre), true);

        expect($debut)->not->toBeFalse();
        expect($ordre[$debut + 1][0])->toBe(Q::LOCKED_READ)
            ->and($ordre[$debut + 1][1])->toContain('"invoices"');
    };
    $this->brouillon = fn (): string => $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');
});

it('émission : le verrou de la facture précède toute lecture', function (): void {
    $id = ($this->brouillon)();

    ($this->verifier)(fn () => app(IssueInvoice::class)->handle($id, $this->today));
});

it('modification et abandon d\'un brouillon : le verrou précède toute lecture', function (): void {
    $id = ($this->brouillon)();
    $donnees = new DraftData($this->partie->id, null, null, null, null, null, [new NewLineData(C::nature(), 'Honoraires', 1000, 5000, TaxCategory::Standard, 'fr_vat_normal')], null, 1);

    ($this->verifier)(fn () => app(UpdateDraft::class)->handle($id, $donnees, $this->today));
    ($this->verifier)(fn () => app(DiscardDraft::class)->handle($id));
});

it('règlement, annulation, avoir et envoi : le verrou précède toute lecture', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $reglement = C::regler($this, $this->org, $facture, 1000)->assertCreated()->json('data.id');

    ($this->verifier)(fn () => app(RecordInvoicePayment::class)->handle($facture->id, new NewPaymentData(500, PaymentMethod::Transfer, '2026-11-18', null, 'cle-ordre-reglement'), $this->today));
    ($this->verifier)(fn () => app(CancelInvoicePayment::class)->handle($facture->id, $reglement, $this->today));
    $second = L::dans($this->org, fn () => InvoicePayment::query()->where('idempotency_key', 'cle-ordre-reglement')->value('id'));
    L::dans($this->org, fn () => app(CancelInvoicePayment::class)->handle($facture->id, $second, $this->today));
    ($this->verifier)(fn () => app(IssueCreditNote::class)->handle($facture->id, new CreditNoteData('Erreur', true, [], 'cle-ordre-avoir'), $this->today));
    ($this->verifier)(fn () => app(SendInvoice::class)->handle($facture->id));
});
