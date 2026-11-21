<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Reporting\Models\ManagementReport;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\Owner\OwnerWriteContext as W;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as RP;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = RP::agence($this);
    $this->awa = X::rattacher($this->org, $this->mandant);
    $this->accueil = fn (?User $compte, string $suite = '') => R::lire($this, $compte, '/home'.$suite);
});

it('sert l\'accueil : mandat, mois en cours, impayé, compteurs et lots, avec le nom du locataire seulement', function (): void {
    C::emises($this->org, $this->bail, $this);

    $reponse = ($this->accueil)($this->awa)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    $d = $reponse->json('data');

    expect(array_keys($d))->toBe(['agency', 'mandant', 'access', 'currency', 'mandate', 'mandates_count', 'month', 'payouts', 'last_report', 'counters', 'units'])
        ->and($d['agency'])->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($d['mandant'])->toBe(['name' => $this->mandant->display_name, 'role' => 'holder'])
        ->and($d['access'])->toBe(['in_grace' => false, 'until' => null])
        ->and($d['mandate']['reference'])->toStartWith('M-2026-')
        ->and($d['mandate']['fee_kind'])->toBe('percentage')->and($d['mandate']['fee_basis_points'])->toBe(700)
        ->and($d['mandate']['payout_day'])->toBe(5)->and($d['mandate']['end_date'])->toBe('2028-12-31')
        ->and($d['mandates_count'])->toBe(1)
        ->and($d['month']['period'])->toBe('2026-11')->and($d['month']['from'])->toBe('2026-11-01')->and($d['month']['to'])->toBe('2026-11-30')
        ->and($d['month']['called'])->toBe(['amount' => 70000, 'currency' => 'EUR'])
        ->and($d['month']['collected'])->toBe(['amount' => 0, 'currency' => 'EUR'])
        ->and($d['month']['arrears']['amount'])->toBe(['amount' => C::du($this->org, $this->bail), 'currency' => 'EUR'])
        ->and($d['month']['arrears']['count'])->toBe(1)->and($d['month']['arrears']['max_days_late'])->toBe(11)
        ->and($d['payouts'])->toBe(['pending' => null, 'last' => null, 'next_date' => '2026-12-05', 'next_notice' => null])
        ->and($d['last_report'])->toBeNull()
        ->and($d['counters'])->toBe(['units_total' => 1, 'units_occupied' => 1, 'units_vacant' => 0, 'quotes_to_decide' => 0])
        ->and($d['units'])->toHaveCount(1)
        ->and(array_keys($d['units'][0]))->toBe(['id', 'reference', 'property_name', 'label', 'type', 'surface_hundredths', 'state', 'tenant', 'rent', 'collected'])
        ->and($d['units'][0]['state'])->toBe('late')
        ->and($d['units'][0]['tenant']['name'])->not->toBeEmpty()
        ->and($d['units'][0]['rent'])->toBe(['amount' => 65000, 'currency' => 'EUR'])
        ->and($d['units'][0]['collected']['amount'])->toBe(0)
        ->and(R::texte($reponse))->not->toContain('locataire.secret')->and(R::texte($reponse))->not->toContain('lease_id');
});

it('passe un lot payé à occupé, et un lot sans bail à vacant, avec le dernier reversement versé', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    X::agence($this, $this->org);
    $lot = F::lotValide($this);

    $attente = ($this->accueil)($this->awa)->assertOk()->json('data');
    expect($attente['payouts']['pending'])->toBe(['net' => ['amount' => 64120, 'currency' => 'EUR'], 'fees' => ['amount' => 5880, 'currency' => 'EUR']])
        ->and($attente['payouts']['last'])->toBeNull();

    $this->actingAs(F::comptable($this->org));
    F::executer($this, $lot)->assertOk();
    $this->travelTo(CarbonImmutable::parse('2026-12-11 10:00:00'));
    $vacant = R::proprietaire($this->org, 'vide@exemple.fr');
    $apres = ($this->accueil)($this->awa)->assertOk()->json('data');

    expect($apres['payouts']['pending'])->toBeNull()
        ->and($apres['payouts']['last']['amount'])->toBe(['amount' => 64120, 'currency' => 'EUR'])
        ->and($apres['payouts']['last']['date'])->toBe('2026-12-10')
        ->and($apres['payouts']['last']['number'])->toStartWith('RV-')
        ->and($apres['month']['period'])->toBe('2026-12')
        ->and($apres['units'][0]['state'])->toBe('occupied')
        ->and(($this->accueil)($vacant['user'])->assertOk()->json('data.units.0.state'))->toBe('vacant')
        ->and(($this->accueil)($vacant['user'])->json('data.counters'))->toBe(['units_total' => 1, 'units_occupied' => 0, 'units_vacant' => 1, 'quotes_to_decide' => 0])
        ->and(($this->accueil)($vacant['user'])->json('data.units.0.tenant'))->toBeNull();
});

it('donne le dernier compte rendu publié, lu ou non, sans rien exposer de plus', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    X::agence($this, $this->org);
    $lot = F::lotValide($this);
    $this->actingAs(F::comptable($this->org));
    F::executer($this, $lot)->assertOk();
    $this->actingAs(L::titulaire($this->org));
    $id = RP::rapport($this);
    RP::cloreDecembre($this);
    RP::publier($this, $id)->assertOk();

    $d = ($this->accueil)($this->awa)->assertOk()->json('data.last_report');
    expect(array_keys($d))->toBe(['id', 'number', 'status', 'period', 'published_at', 'first_read_at', 'is_read'])
        ->and($d['id'])->toBe($id)->and($d['status'])->toBe('published')
        ->and($d['period'])->toBe(['kind' => 'monthly', 'start' => '2026-11-01', 'end' => '2026-11-30'])
        ->and($d['published_at'])->not->toBeNull()->and($d['is_read'])->toBeFalse()->and($d['first_read_at'])->toBeNull();

    RP::dans($this->org, fn () => ManagementReport::query()->whereKey($id)->update(['first_read_at' => now()]));
    expect(($this->accueil)($this->awa)->json('data.last_report.is_read'))->toBeTrue();
});

it('compte les devis qui attendent la décision du mandant, jamais ceux d\'un autre', function (): void {
    $this->awa->forceFill(['email' => 'premiere@exemple.fr'])->save();
    ['scene' => $scene, 'awa' => $awa] = W::agence($this);
    W::demande($this, $scene);
    $autre = R::proprietaire($scene['org'], 'autre@exemple.fr');

    expect(($this->accueil)($awa)->assertOk()->json('data.counters.quotes_to_decide'))->toBe(1)
        ->and(($this->accueil)($autre['user'])->assertOk()->json('data.counters.quotes_to_decide'))->toBe(0);

    $indivisaire = X::rattacher($scene['org'], $scene['mandant'], 'co@exemple.fr', OwnerAccessRole::CoOwner);
    expect(($this->accueil)($indivisaire)->assertOk()->json('data.counters.quotes_to_decide'))->toBe(0);
});

it('n\'ouvre aux co-indivisaires ni reversement ni compte du mandant dans l\'accueil', function (): void {
    $indivisaire = X::rattacher($this->org, $this->mandant, 'co@exemple.fr', OwnerAccessRole::CoOwner);

    $d = ($this->accueil)($indivisaire)->assertOk()->json('data');

    expect($d['payouts'])->toBeNull()->and($d['mandant']['role'])->toBe('co_owner')->and($d['units'])->toHaveCount(1);
});

it('exige une session et un profil propriétaire', function (): void {
    O::comme($this, null)->getJson('/api/v1/owner/home')->assertUnauthorized();

    foreach ([User::factory()->create(), T::locataire($this->org)['user'], L::titulaire($this->org)] as $compte) {
        ($this->accueil)($compte)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    }
});

it('ne mêle jamais les chiffres d\'un autre propriétaire ni d\'une autre agence, même si le client désigne un mandant', function (): void {
    C::emises($this->org, $this->bail, $this);
    $bob = R::proprietaire($this->org, 'bob@exemple.fr');
    $autre = T::organisation('Immo Loire');
    $loire = R::proprietaire($autre, 'loire@exemple.fr');
    R::bail($autre, $loire['unit'], [], 'Louis Loire', 99900);

    $lui = ($this->accueil)($bob['user'], '?mandant='.$this->mandant->id.'&organization_id='.$this->org->id)->assertOk();
    $siens = R::texte(($this->accueil)($this->awa)->assertOk());

    expect($lui->json('data.mandant.name'))->not->toBe($this->mandant->display_name)
        ->and($lui->json('data.month.called.amount'))->toBe(0)
        ->and($lui->json('data.units'))->toHaveCount(1)->and($lui->json('data.units.0.id'))->toBe($bob['unit']->id)
        ->and(R::texte($lui))->not->toContain('70000')->not->toContain('Pauline')
        ->and($siens)->not->toContain($loire['unit']->reference)->not->toContain('Immo Loire')->not->toContain('Louis Loire')
        ->and(($this->accueil)($this->awa, '?agency='.$autre->id)->assertNotFound()->json('code'))->toBe('owner_agency_not_found');
    ($this->accueil)($loire['user'], '?agency='.$this->org->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
    ($this->accueil)($this->awa, '?agency=nimporte')->assertNotFound();
});

it('exige l\'agence quand le compte a plusieurs mandants, puis sert chaque agence séparément', function (): void {
    C::emises($this->org, $this->bail, $this);
    $autre = T::organisation('Immo Loire');
    $loire = R::proprietaire($autre, 'loire@exemple.fr');
    L::dans($autre, fn () => $loire['access']->forceFill(['user_id' => $this->awa->id])->save());

    ($this->accueil)($this->awa)->assertUnprocessable()->assertJsonPath('code', 'owner_agency_required');
    $chez = ($this->accueil)($this->awa, '?agency='.$this->org->id)->assertOk();
    $ailleurs = ($this->accueil)($this->awa, '?agency='.$autre->id)->assertOk();

    expect($chez->json('data.agency.id'))->toBe($this->org->id)->and($chez->json('data.month.called.amount'))->toBe(70000)
        ->and($ailleurs->json('data.agency.id'))->toBe($autre->id)->and($ailleurs->json('data.month.called.amount'))->toBe(0)
        ->and($ailleurs->json('data.units.0.id'))->toBe($loire['unit']->id);
});

it('ne montre plus rien d\'un mandat dont l\'accès est échu', function (): void {
    L::dans($this->org, fn () => MandateUnit::query()->update(['valid_to' => '2026-01-02']));
    $d = ($this->accueil)($this->awa)->assertOk()->json('data');

    expect($d['units'])->toBe([])->and($d['mandate'])->toBeNull()->and($d['mandates_count'])->toBe(0)->and($d['counters']['units_total'])->toBe(0);
});
