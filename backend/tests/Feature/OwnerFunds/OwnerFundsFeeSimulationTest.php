<?php

declare(strict_types=1);

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;

/**
 * @param  array<string, mixed>  $surcharge
 * @return array<string, mixed>
 */
function propositionHonoraires(string $mandat, array $surcharge = []): array
{
    return ['mandate_id' => $mandat, 'months' => 1, 'fee_kind' => 'percentage', 'fee_basis_points' => 1000, 'fee_base' => 'rent', ...$surcharge];
}

/**
 * @return array<string, int>
 */
function compteursEcritures(object $test): array
{
    return L::dans($test->org, fn (): array => [
        'fee_statements' => DB::table('fee_statements')->count(),
        'journal_entries' => DB::table('journal_entries')->count(),
        'journal_lines' => DB::table('journal_lines')->count(),
        'invoices' => DB::table('invoices')->count(),
        'audit_logs' => DB::table('audit_logs')->count(),
    ]);
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    $this->mandat = L::dans($this->org, fn (): string => Mandate::query()->firstOrFail()->id);
    $this->url = F::url($this->org, '/fees/simulations');
});

it('simule un barème sur le dernier mois clos : base, honoraires en vigueur, honoraires simulés et écart', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $r = $this->postJson($this->url, propositionHonoraires($this->mandat))->assertOk();

    expect($r->json('data'))->toHaveCount(1)
        ->and($r->json('data.0.month'))->toBe('2026-11')
        ->and($r->json('data.0.base_rent'))->toBe(['amount' => 65000, 'currency' => 'EUR'])
        ->and($r->json('data.0.base_charges'))->toBe(['amount' => 5000, 'currency' => 'EUR'])
        ->and($r->json('data.0.current.source'))->toBe('computed')
        ->and($r->json('data.0.current.fee_net.amount'))->toBe(4900)
        ->and($r->json('data.0.current.fee_total.amount'))->toBe(5880)
        ->and($r->json('data.0.simulated.source'))->toBe('simulation')
        ->and($r->json('data.0.simulated.fee_net.amount'))->toBe(6500)
        ->and($r->json('data.0.simulated.tax_amount.amount'))->toBe(1300)
        ->and($r->json('data.0.simulated.fee_total.amount'))->toBe(7800)
        ->and($r->json('data.0.difference.fee_net.amount'))->toBe(1600)
        ->and($r->json('data.0.difference.fee_total.amount'))->toBe(1920)
        ->and($r->json('meta.reason'))->toBeNull()
        ->and($r->json('meta.months_returned'))->toBe(1)
        ->and($r->json('meta.totals.simulated_fee_total.amount'))->toBe(7800)
        ->and($r->json('meta.totals.difference_fee_total.amount'))->toBe(1920);
});

it('reprend le relevé posé quand le mois est déjà facturé', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    F::lotValide($this);

    $r = $this->postJson($this->url, propositionHonoraires($this->mandat))->assertOk();

    expect($r->json('data.0.current.source'))->toBe('statement')
        ->and($r->json('data.0.current.fee_net.amount'))->toBe(4900)
        ->and($r->json('data.0.current.tax_amount.amount'))->toBe(980);
});

it('n\'écrit rien : ni relevé, ni écriture comptable, ni facture, ni journal d\'activité', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $avant = compteursEcritures($this);

    $this->postJson($this->url, propositionHonoraires($this->mandat))->assertOk();
    $this->postJson($this->url, propositionHonoraires($this->mandat, ['fee_kind' => 'flat', 'fee_basis_points' => null, 'fee_flat_amount' => 3000]))->assertOk();

    expect(compteursEcritures($this))->toBe($avant)->and($avant['fee_statements'])->toBe(0);
});

it('un mois non clos n\'est pas simulé : liste vide et motif no_closed_period', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();

    $r = $this->postJson($this->url, propositionHonoraires($this->mandat))->assertOk();

    expect($r->json('data'))->toBe([])
        ->and($r->json('meta.reason'))->toBe('no_closed_period')
        ->and($r->json('meta.totals'))->toBeNull();
});

it('arrondit au demi supérieur en unités mineures', function (array $surcharge, int $net, int $taxe, int $total): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $r = $this->postJson($this->url, propositionHonoraires($this->mandat, $surcharge))->assertOk();

    expect($r->json('data.0.simulated.fee_net.amount'))->toBe($net)
        ->and($r->json('data.0.simulated.tax_amount.amount'))->toBe($taxe)
        ->and($r->json('data.0.simulated.fee_total.amount'))->toBe($total);
})->with([
    'loyer à 1 point de base : 6,5 devient 7' => [['fee_basis_points' => 1], 7, 1, 8],
    'loyer et charges à 1 point de base : 7' => [['fee_basis_points' => 1, 'fee_base' => 'rent_and_charges'], 7, 1, 8],
    'loyer à 5 points de base : 32,5 devient 33' => [['fee_basis_points' => 5], 33, 7, 40],
    'forfait de 3 unités' => [['fee_kind' => 'flat', 'fee_basis_points' => null, 'fee_flat_amount' => 3], 3, 1, 4],
    'forfait de 7 unités' => [['fee_kind' => 'flat', 'fee_basis_points' => null, 'fee_flat_amount' => 7], 7, 1, 8],
]);

it('applique le minimum et le mode toutes taxes comprises', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $minimum = $this->postJson($this->url, propositionHonoraires($this->mandat, ['fee_minimum_amount' => 10000]))->assertOk();
    $ttc = $this->postJson($this->url, propositionHonoraires($this->mandat, ['fee_base' => 'rent_and_charges', 'fee_tax_mode' => 'incl_tax']))->assertOk();

    expect($minimum->json('data.0.simulated.fee_net.amount'))->toBe(10000)
        ->and($minimum->json('data.0.simulated.minimum_applied'))->toBeTrue()
        ->and($ttc->json('data.0.simulated.fee_net.amount'))->toBe(5833)
        ->and($ttc->json('data.0.simulated.tax_amount.amount'))->toBe(1167)
        ->and($ttc->json('data.0.simulated.fee_total.amount'))->toBe(7000);
});

it('refuse une proposition sans base d\'honoraires avec fee_base_missing', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $corps = propositionHonoraires($this->mandat);
    unset($corps['fee_base']);

    $this->postJson($this->url, $corps)->assertStatus(422)->assertJsonPath('code', 'fee_base_missing');
});

it('valide la proposition : points de base, forfait, mois et mandat', function (array $surcharge): void {
    $this->postJson($this->url, propositionHonoraires($this->mandat, $surcharge))->assertStatus(422);
})->with([
    'points de base hors bornes' => [['fee_basis_points' => 10001]],
    'forfait avec un pourcentage' => [['fee_flat_amount' => 100]],
    'pourcentage sans point de base' => [['fee_basis_points' => null]],
    'montant négatif' => [['fee_kind' => 'flat', 'fee_basis_points' => null, 'fee_flat_amount' => -1]],
    'plus de 12 mois' => [['months' => 13]],
    'zéro mois' => [['months' => 0]],
    'base inconnue' => [['fee_base' => 'turnover']],
    'mandat non uuid' => [['mandate_id' => 'abc']],
]);

it('renvoie 404 pour un mandat inconnu ou d\'une autre organisation', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $autre = C::organisation(nom: 'Autre agence');
    ['lot' => $lot] = C::bail($autre);
    $mandatAutre = M::actif($autre, $lot, M::partie($autre));
    $this->actingAs(L::titulaire($this->org));

    $this->postJson($this->url, propositionHonoraires((string) $mandatAutre->id))->assertStatus(404)->assertJsonPath('code', 'owner_funds_mandate_not_found');
    $this->postJson($this->url, propositionHonoraires('0199ffff-ffff-7fff-8fff-ffffffffffff'))->assertStatus(404)->assertJsonPath('code', 'owner_funds_mandate_not_found');
});

it('est ouverte aux quatre rôles de gestion', function (MemberRole $role): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $compte = L::membre($this->org, $role);
    activerDeuxFacteurs($compte);
    X::changer();
    $this->actingAs($compte);

    $this->postJson($this->url, propositionHonoraires($this->mandat))->assertOk()->assertJsonPath('data.0.simulated.fee_net.amount', 6500);
})->with([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant]);

it('limite à 20 simulations par minute et par utilisateur', function (): void {
    Cache::flush();
    $codes = [];

    foreach (range(1, 21) as $_) {
        $codes[] = $this->postJson($this->url, [])->getStatusCode();
    }

    expect($codes[19])->toBe(422)->and($codes[20])->toBe(429);
});

it('plafonne les montants de la proposition : au-delà de 100 milliards d\'unités mineures, 422 et jamais 500', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    foreach ([100_000_000_001, 9_000_000_000_000_000_000] as $trop) {
        $this->postJson($this->url, propositionHonoraires($this->mandat, ['fee_kind' => 'flat', 'fee_basis_points' => null, 'fee_flat_amount' => $trop]))
            ->assertUnprocessable()->assertJsonValidationErrors('fee_flat_amount');
        $this->postJson($this->url, propositionHonoraires($this->mandat, ['fee_minimum_amount' => $trop]))
            ->assertUnprocessable()->assertJsonValidationErrors('fee_minimum_amount');
    }

    $limite = $this->postJson($this->url, propositionHonoraires($this->mandat, ['fee_minimum_amount' => 100_000_000_000]))->assertOk();
    expect($limite->json('data.0.simulated.fee_net.amount'))->toBe(100_000_000_000);
});
