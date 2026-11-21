<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\OwnerFunds\Models\FeeStatement;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Tests\Feature\Invoicing\InvoicingContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
});

function cloreJusqua(object $test, string $avant): void
{
    foreach (F::moisAClore($test->org, $avant) as $mois) {
        F::envoyer($test, 'POST', "/api/v1/org/{$test->org->id}/accounting/periods/close", ['month' => $mois])->assertSuccessful();
    }
}

it('les honoraires sont facturés une seule fois par mois clos : facture serveur, relevé en ajout seul, TVA ajoutée', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated()->json('data.id');
    F::valider($this, $lot)->assertOk();

    $releves = $this->getJson(F::url($this->org, '/fees'))->assertOk();
    $facture = L::dans($this->org, fn () => Invoice::query()->firstOrFail());

    expect($releves->json('data'))->toHaveCount(1)
        ->and($releves->json('data.0.month'))->toBe('2026-11')
        ->and($releves->json('data.0.fee_net.amount'))->toBe(4900)
        ->and($releves->json('data.0.tax_amount.amount'))->toBe(980)
        ->and($releves->json('data.0.fee_total.amount'))->toBe(5880)
        ->and($releves->json('data.0.invoice_id'))->toBe($facture->id)
        ->and($facture->fee_statement_id)->toBe($releves->json('data.0.id'))
        ->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(0);

    F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertStatus(409);
    expect(L::dans($this->org, fn () => FeeStatement::query()->count()))->toBe(1)
        ->and(L::dans($this->org, fn () => Invoice::query()->count()))->toBe(1);
});

it('le relevé est en ajout seul en base : ni modification ni suppression', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated()->json('data.id');
    F::valider($this, $lot)->assertOk();

    expect(fn () => L::dans($this->org, fn () => FeeStatement::query()->update(['fee_net' => 1])))->toThrow(QueryException::class)
        ->and(fn () => L::dans($this->org, fn () => FeeStatement::query()->delete()))->toThrow(QueryException::class);
});

it('une facture d\'honoraires ne se saisit pas à la main une fois le routage actif', function (): void {
    $destinataire = I::destinataire($this->org);

    $this->postJson("/api/v1/org/{$this->org->id}/invoices", I::brouillon($destinataire))->assertStatus(422)->assertJsonPath('code', 'invoice_fee_computed_by_server');
});

it('un mois en recul (encaissement annulé après la clôture) génère un avoir qui réduit la compensation', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 35000)->assertCreated();
    $second = C::payer($this, $this->org, $this->bail, 35000)->assertCreated()->json('data.id');
    $this->travelTo(CarbonImmutable::parse('2026-12-10 10:00:00'));
    cloreJusqua($this, '2026-12-01');

    $this->postJson(C::url($this->org, "/payments/{$second}/cancel"), ['reason' => 'Chèque rejeté'])->assertOk();
    $this->travelTo(CarbonImmutable::parse('2027-01-10 10:00:00'));
    cloreJusqua($this, '2027-01-01');

    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated()->json('data.id');
    $valide = F::valider($this, $lot)->assertOk();
    $releves = $this->getJson(F::url($this->org, '/fees'))->assertOk()->json('data');
    $dec = collect($releves)->firstWhere('month', '2026-12');

    expect($dec['fee_net']['amount'])->toBe(-2450)
        ->and($dec['credit_note_id'])->not->toBeNull()
        ->and($valide->json('data.items.0.fees_settled_amount.amount'))->toBe(2940)
        ->and($valide->json('data.items.0.net_amount.amount'))->toBe(32060)
        ->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(0);
});
