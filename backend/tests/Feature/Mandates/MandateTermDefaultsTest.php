<?php

declare(strict_types=1);

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateTermDefault;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext as X;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->travelTo(CarbonImmutable::parse('2026-11-20 10:00:00'));
    $this->url = M::url($this->org, '/term-defaults');
    $this->corps = ['fee_kind' => 'percentage', 'fee_basis_points' => 800, 'fee_base' => 'rent', 'payout_day' => 7, 'works_limit_amount' => 30000, 'fee_minimum_amount' => 2500, 'letting_fee_basis_points' => 10000, 'works_fee_basis_points' => 500];
    $this->actingAs(M::titulaire($this->org));
});

it('répond 404 tant qu\'aucun défaut n\'est posé, puis renvoie le modèle écrit', function (): void {
    $this->getJson($this->url)->assertNotFound()->assertJsonPath('code', 'mandate_term_defaults_not_found');

    $this->putJson($this->url, $this->corps)->assertCreated()
        ->assertJsonPath('data.fee_kind', 'percentage')
        ->assertJsonPath('data.fee_basis_points', 800)
        ->assertJsonPath('data.fee_flat_amount', null)
        ->assertJsonPath('data.fee_base', 'rent')
        ->assertJsonPath('data.fee_minimum_amount', ['amount' => 2500, 'currency' => 'EUR'])
        ->assertJsonPath('data.fee_tax_mode', 'excl_tax')
        ->assertJsonPath('data.payout_day', 7)
        ->assertJsonPath('data.works_limit_amount', ['amount' => 30000, 'currency' => 'EUR'])
        ->assertJsonPath('data.letting_fee_basis_points', 10000)
        ->assertJsonPath('data.works_fee_basis_points', 500)
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.lock_version', 1);

    $this->getJson($this->url)->assertOk()->assertJsonPath('data.fee_basis_points', 800);
});

it('exige la version courante dès la seconde écriture et refuse une version à la première', function (): void {
    $this->putJson($this->url, [...$this->corps, 'lock_version' => 1])->assertConflict()->assertJsonPath('code', 'mandate_stale_version');
    $this->putJson($this->url, $this->corps)->assertCreated();

    $this->putJson($this->url, [...$this->corps, 'fee_basis_points' => 900])->assertConflict()->assertJsonPath('code', 'mandate_stale_version');
    $this->putJson($this->url, [...$this->corps, 'fee_basis_points' => 900, 'lock_version' => 7])->assertConflict()->assertJsonPath('code', 'mandate_stale_version');
    $this->putJson($this->url, [...$this->corps, 'fee_basis_points' => 900, 'lock_version' => 1])->assertOk()->assertJsonPath('data.lock_version', 2);

    expect(M::dans($this->org, fn () => MandateTermDefault::query()->count()))->toBe(1);
});

it('remplace tout le modèle : un champ omis retombe à sa valeur par défaut et le forfait remplace le taux', function (): void {
    $this->putJson($this->url, $this->corps)->assertCreated();

    $this->putJson($this->url, ['lock_version' => 1, 'fee_kind' => 'flat', 'fee_flat_amount' => 15000, 'fee_base' => 'rent_and_charges', 'payout_day' => 3, 'fee_tax_mode' => 'incl_tax'])
        ->assertOk()
        ->assertJsonPath('data.fee_kind', 'flat')
        ->assertJsonPath('data.fee_basis_points', null)
        ->assertJsonPath('data.fee_flat_amount', ['amount' => 15000, 'currency' => 'EUR'])
        ->assertJsonPath('data.fee_tax_mode', 'incl_tax')
        ->assertJsonPath('data.works_limit_amount.amount', 0)
        ->assertJsonPath('data.fee_minimum_amount.amount', 0)
        ->assertJsonPath('data.letting_fee_basis_points', null);
});

it('valide le barème : base obligatoire, taux de 0 à 10 000 points de base entiers, jour de 1 à 28, taux ou forfait', function (array $change, string $champ): void {
    $this->putJson($this->url, [...$this->corps, ...$change])->assertUnprocessable()->assertJsonValidationErrors($champ);
    expect(M::dans($this->org, fn () => MandateTermDefault::query()->count()))->toBe(0);
})->with([
    'base absente' => [['fee_base' => null], 'fee_base'],
    'base inconnue' => [['fee_base' => 'encaisses'], 'fee_base'],
    'taux au-dessus de 100 %' => [['fee_basis_points' => 10001], 'fee_basis_points'],
    'taux décimal' => [['fee_basis_points' => 7.5], 'fee_basis_points'],
    'taux et forfait' => [['fee_flat_amount' => 100], 'fee_flat_amount'],
    'jour hors plage' => [['payout_day' => 29], 'payout_day'],
    'relocation négative' => [['letting_fee_basis_points' => -1], 'letting_fee_basis_points'],
    'relocation au-dessus de 100 %' => [['letting_fee_basis_points' => 10001], 'letting_fee_basis_points'],
    'suivi de travaux décimal' => [['works_fee_basis_points' => 2.5], 'works_fee_basis_points'],
]);

it('ne prend du client ni l\'organisation ni la devise', function (): void {
    $autre = M::organisation();

    $this->putJson($this->url, [...$this->corps, 'organization_id' => $autre->id, 'currency' => 'XOF', 'id' => (string) fake()->uuid()])->assertCreated()->assertJsonPath('data.currency', 'EUR');

    $ligne = M::dans($this->org, fn () => MandateTermDefault::query()->firstOrFail());
    expect($ligne->organization_id)->toBe($this->org->id)
        ->and(M::dans($autre, fn () => MandateTermDefault::query()->count()))->toBe(0);
});

it('ne touche aucun mandat existant et ne complète jamais une création muette', function (): void {
    $mandat = M::actif($this->org, M::lot($this->org), M::partie($this->org));
    $brouillon = M::mandat($this->org, M::lot($this->org), M::partie($this->org));
    $instantane = fn (): array => M::dans($this->org, fn (): array => [
        Mandate::query()->orderBy('id')->get()->map(fn (Mandate $m): array => $m->getAttributes())->all(),
        MandateTerm::query()->orderBy('id')->get()->map(fn (MandateTerm $t): array => $t->getAttributes())->all(),
    ]);
    $avant = $instantane();

    $this->putJson($this->url, $this->corps)->assertCreated();
    $this->putJson($this->url, [...$this->corps, 'fee_basis_points' => 1200, 'payout_day' => 20, 'lock_version' => 1])->assertOk();

    expect($instantane())->toBe($avant);
    $this->getJson(M::url($this->org, "/{$mandat->id}"))->assertOk()->assertJsonPath('data.terms.fee_basis_points', 700)->assertJsonPath('data.terms.payout_day', 5);

    $silencieux = M::payload(M::lot($this->org), M::partie($this->org), ['terms' => ['fee_kind' => 'percentage', 'fee_basis_points' => 700, 'payout_day' => 5]]);
    $this->postJson(M::url($this->org), $silencieux)->assertUnprocessable()->assertJsonValidationErrors('terms.fee_base');
    expect(M::dans($this->org, fn () => Mandate::query()->count()))->toBe(2)->and($brouillon->id)->not->toBe($mandat->id);
});

it('journalise la création puis chaque modification du modèle, sans donnée personnelle', function (): void {
    $this->putJson($this->url, $this->corps)->assertCreated();
    $this->putJson($this->url, [...$this->corps, 'fee_basis_points' => 900, 'lock_version' => 1])->assertOk();

    $lignes = AuditLog::query()->whereIn('action', ['mandate_term_defaults.created', 'mandate_term_defaults.updated'])->orderBy('occurred_at')->orderBy('id')->get();

    expect($lignes)->toHaveCount(2)
        ->and($lignes[1]->action)->toBe('mandate_term_defaults.updated')
        ->and($lignes[1]->changes['fee_basis_points'])->toBe(['old' => 800, 'new' => 900])
        ->and($lignes[1]->organization_id)->toBe($this->org->id);
});

it('401 sans session, 403 en écriture pour le gestionnaire et le comptable qui lisent, 404 hors organisation', function (): void {
    $this->putJson($this->url, $this->corps)->assertCreated();
    X::changer();
    $this->putJson($this->url, $this->corps)->assertUnauthorized();
    $this->getJson($this->url)->assertUnauthorized();

    foreach ([MemberRole::Manager, MemberRole::Accountant] as $role) {
        M::basculer($this, M::membre($this->org, $role));
        $this->putJson($this->url, [...$this->corps, 'lock_version' => 1])->assertForbidden()->assertJsonPath('code', 'role_forbidden');
        $this->getJson($this->url)->assertOk()->assertJsonPath('data.fee_basis_points', 800);
    }

    M::basculer($this, M::membre($this->org, MemberRole::Admin));
    $this->putJson($this->url, [...$this->corps, 'fee_basis_points' => 950, 'lock_version' => 1])->assertOk();

    $etranger = M::organisation();
    M::basculer($this, M::titulaire($etranger));
    $this->getJson($this->url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    $this->putJson($this->url, $this->corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    $this->getJson(M::url($etranger, '/term-defaults'))->assertNotFound()->assertJsonPath('code', 'mandate_term_defaults_not_found');
});

it('refuse un propriétaire autonome et un jeton opérateur', function (): void {
    $individuelle = M::organisation(OrganizationKind::Individual);
    M::basculer($this, M::titulaire($individuelle));
    $this->getJson(M::url($individuelle, '/term-defaults'))->assertForbidden()->assertJsonPath('code', 'mandate_agency_only');
    $this->putJson(M::url($individuelle, '/term-defaults'), $this->corps)->assertForbidden()->assertJsonPath('code', 'mandate_agency_only');

    M::basculer($this, M::membre($this->org, MemberRole::Admin));
    $jeton = X::jetonOperateur(M::membre($this->org, MemberRole::Admin));
    X::changer();
    $this->withToken($jeton)->getJson($this->url)->assertStatus(403);
    $this->withToken($jeton)->putJson($this->url, $this->corps)->assertStatus(403);
});

it('limite l\'écriture à 20 appels par minute et la lecture à 120', function (): void {
    Cache::flush();
    $codes = [];

    foreach (range(1, 21) as $_) {
        $codes[] = $this->putJson($this->url, [])->getStatusCode();
    }

    expect($codes[19])->toBe(422)->and($codes[20])->toBe(429);

    Cache::flush();
    $trop = 0;

    foreach (range(1, 120) as $_) {
        $trop += $this->getJson($this->url)->getStatusCode() === 429 ? 1 : 0;
    }

    expect($trop)->toBe(0)->and($this->getJson($this->url)->getStatusCode())->toBe(429);
});

it('plafonne les montants des conditions par défaut à 100 milliards d\'unités mineures : 422, jamais 500', function (): void {
    foreach (['fee_minimum_amount', 'works_limit_amount'] as $champ) {
        $this->putJson($this->url, [...$this->corps, $champ => 100_000_000_001])->assertUnprocessable()->assertJsonValidationErrors($champ);
        $this->putJson($this->url, [...$this->corps, $champ => 9_000_000_000_000_000_000])->assertUnprocessable()->assertJsonValidationErrors($champ);
    }
    $this->putJson($this->url, [...$this->corps, 'fee_kind' => 'flat', 'fee_basis_points' => null, 'fee_flat_amount' => 100_000_000_001])->assertUnprocessable()->assertJsonValidationErrors('fee_flat_amount');

    $this->putJson($this->url, [...$this->corps, 'fee_minimum_amount' => 100_000_000_000])->assertCreated();
});
