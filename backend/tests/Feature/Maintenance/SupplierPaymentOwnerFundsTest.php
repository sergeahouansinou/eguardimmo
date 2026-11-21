<?php

declare(strict_types=1);

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

function financerMandant(array $scene, int $montant): void
{
    L::dans($scene['org'], fn () => app(Ledger::class)->post(new EntryData(
        Journal::Bank, CarbonImmutable::parse('2026-11-15'), 'Loyer encaissé', SourceType::Payment, (string) Str::uuid7(), 'fonds-'.Str::random(8),
        [LineData::debit(AccountRole::TrustBank, Money::EUR($montant)), LineData::credit(AccountRole::OwnerPayable, Money::EUR($montant), null, $scene['mandant']->id)],
    )));
}

function activerFonds(array $scene): void
{
    L::dans($scene['org'], fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
}

function reglement(object $test, array $scene, string $intervention, string $facture, array $corps = []): TestResponse
{
    return $test->postJson(C::url($scene['org'], "/interventions/{$intervention}/invoices/{$facture}/payments"), [
        'amount' => 24000, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-'.bin2hex(random_bytes(4)), ...$corps,
    ]);
}

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    $this->intervention = C::travauxTermines($this, $this->scene);
    $this->facture = C::facture($this, $this->scene, $this->intervention, ['declared_gross' => 24000])->assertCreated()->json('data.id');
});

it('sans fonds des mandants actifs, le règlement sort de la banque comme avant', function (): void {
    reglement($this, $this->scene, $this->intervention, $this->facture)->assertCreated();

    expect(F::solde($this->scene['org'], AccountRole::Bank))->toBe(24000)->and(F::solde($this->scene['org'], AccountRole::TrustBank))->toBe(0);
});

it('avec fonds actifs, le règlement sort de la banque de tiers quand le solde du mandant couvre la facture', function (): void {
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);

    reglement($this, $this->scene, $this->intervention, $this->facture)->assertCreated();

    expect(F::solde($this->scene['org'], AccountRole::TrustBank))->toBe(-6000)
        ->and(F::solde($this->scene['org'], AccountRole::Bank))->toBe(0);
});

it('refuse 409 owner_funds_insufficient quand le solde du mandant ne couvre pas la facture, sans rien écrire', function (): void {
    activerFonds($this->scene);
    financerMandant($this->scene, 10000);

    reglement($this, $this->scene, $this->intervention, $this->facture)->assertStatus(409)->assertJsonPath('code', 'owner_funds_insufficient');

    expect(F::solde($this->scene['org'], AccountRole::SupplierPayable))->toBe(24000)
        ->and(L::dans($this->scene['org'], fn () => DB::table('supplier_payments')->count()))->toBe(0);
});

it('l\'avance sur fonds propres est une saisie explicite depuis la banque, tracée à l\'audit', function (): void {
    activerFonds($this->scene);

    $paiement = reglement($this, $this->scene, $this->intervention, $this->facture, ['own_funds_advance' => true])->assertCreated();

    $audit = L::dans($this->scene['org'], fn () => DB::table('audit_logs')->where('action', 'maintenance.payment.recorded')->value('metadata'));
    expect(F::solde($this->scene['org'], AccountRole::Bank))->toBe(24000)
        ->and(F::solde($this->scene['org'], AccountRole::TrustBank))->toBe(0)
        ->and((string) $audit)->toContain('"source":"bank"')
        ->and($paiement->json('data.id'))->not->toBeNull();
});

it('un règlement en espèces ne sort pas de la banque de tiers', function (): void {
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);

    reglement($this, $this->scene, $this->intervention, $this->facture, ['method' => 'cash'])->assertUnprocessable()->assertJsonPath('code', 'supplier_payment_invalid');
});

it('le règlement et son annulation exigent la double authentification, même pour un comptable, et restent fermés au gestionnaire', function (): void {
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);
    $url = C::url($this->scene['org'], "/interventions/{$this->intervention}/invoices/{$this->facture}/payments");
    $corps = ['amount' => 24000, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-2fa-1'];

    C::comme($this, L::membre($this->scene['org'], MemberRole::Accountant));
    $this->postJson($url, $corps)->assertForbidden()->assertJsonPath('code', 'two_factor_required');
    $this->postJson(C::url($this->scene['org'], '/supplier-payments/'.Str::uuid().'/cancel'), [])->assertForbidden()->assertJsonPath('code', 'two_factor_required');

    C::comme($this, L::membre($this->scene['org'], MemberRole::Manager));
    $this->postJson($url, $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    $comptable = L::membre($this->scene['org'], MemberRole::Accountant);
    activerDeuxFacteurs($comptable);
    C::comme($this, $comptable);
    $this->postJson($url, $corps)->assertCreated();
});

it('même clé d\'idempotence avec une avance sur fonds propres différente : 409, rien n\'est rejoué', function (): void {
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);

    reglement($this, $this->scene, $this->intervention, $this->facture, ['idempotency_key' => 'reglement-avance-1'])->assertCreated();
    reglement($this, $this->scene, $this->intervention, $this->facture, ['idempotency_key' => 'reglement-avance-1', 'own_funds_advance' => true])->assertStatus(409)->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    reglement($this, $this->scene, $this->intervention, $this->facture, ['idempotency_key' => 'reglement-avance-1'])->assertOk();

    expect(L::dans($this->scene['org'], fn () => DB::table('supplier_payments')->count()))->toBe(1);
});

it('sur fonds de tiers, un règlement exige un engagement ; sur fonds propres il passe encore', function (): void {
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);
    L::dans($this->scene['org'], function (): void {
        DB::table('interventions')->update(['estimated_amount' => null]);
        DB::table('intervention_quotes')->update(['status' => 'superseded']);
    });

    reglement($this, $this->scene, $this->intervention, $this->facture)->assertStatus(409)->assertJsonPath('code', 'supplier_payment_engagement_required');
    reglement($this, $this->scene, $this->intervention, $this->facture, ['own_funds_advance' => true])->assertCreated();
});

it('un écart de cantonnement bloque le règlement sur fonds de tiers, sans rien écrire', function (): void {
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);
    L::dans($this->scene['org'], fn () => app(Ledger::class)->post(new EntryData(
        Journal::Bank, CarbonImmutable::parse('2026-11-16'), 'Prélèvement indu', SourceType::TrustTransfer, (string) Str::uuid7(), 'ecart-reglement',
        [LineData::debit(AccountRole::Bank, Money::EUR(20000)), LineData::credit(AccountRole::TrustBank, Money::EUR(20000))],
    )));

    reglement($this, $this->scene, $this->intervention, $this->facture)->assertStatus(409)->assertJsonPath('code', 'trust_funds_gap');

    expect(L::dans($this->scene['org'], fn () => DB::table('supplier_payments')->count()))->toBe(0);
    reglement($this, $this->scene, $this->intervention, $this->facture, ['own_funds_advance' => true])->assertCreated();
});

it('au-delà du seuil, le règlement sur fonds de tiers exige une autre personne que celle qui a saisi la facture', function (): void {
    config(['maintenance.third_party_second_approval_minor' => 10000]);
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);
    $comptable = L::membre($this->scene['org'], MemberRole::Accountant);
    activerDeuxFacteurs($comptable);

    reglement($this, $this->scene, $this->intervention, $this->facture, ['amount' => 12000])->assertForbidden()->assertJsonPath('code', 'supplier_payment_second_approver_required');
    expect(L::dans($this->scene['org'], fn () => DB::table('supplier_payments')->count()))->toBe(0);

    C::comme($this, $comptable);
    reglement($this, $this->scene, $this->intervention, $this->facture, ['amount' => 12000])->assertCreated();
});

it('sous le seuil, ou sur fonds propres, la même personne règle la facture qu\'elle a saisie', function (bool $avance, int $montant): void {
    config(['maintenance.third_party_second_approval_minor' => 10000]);
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);
    activerDeuxFacteurs(L::membre($this->scene['org'], MemberRole::Accountant));

    reglement($this, $this->scene, $this->intervention, $this->facture, ['amount' => $montant, 'own_funds_advance' => $avance])->assertCreated();
})->with([
    'sous le seuil' => [false, 9000],
    'avance sur fonds propres' => [true, 12000],
]);

it('en solo (un seul membre habilité), le seuil ne bloque pas', function (): void {
    config(['maintenance.third_party_second_approval_minor' => 10000]);
    activerFonds($this->scene);
    financerMandant($this->scene, 30000);

    reglement($this, $this->scene, $this->intervention, $this->facture, ['amount' => 12000])->assertCreated();
});
