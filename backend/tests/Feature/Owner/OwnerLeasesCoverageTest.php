<?php

declare(strict_types=1);

use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Mandates\Models\MandateUnit;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as LR;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->a = R::proprietaire($this->org);
    $this->b = R::proprietaire($this->org, 'bob@exemple.fr');
});

function bailTransfere(object $t): void
{
    $t->bail = R::bail($t->org, $t->a['unit']);
    L::dans($t->org, fn () => MandateUnit::query()->where('unit_id', $t->a['unit']->id)->update(['valid_to' => '2026-07-01']));
    L::dans($t->org, fn () => MandateUnit::factory()->create(['mandate_id' => $t->b['mandate']->id, 'unit_id' => $t->a['unit']->id, 'valid_from' => '2026-07-01']));
    L::dans($t->org, fn () => LeaseTerm::query()->where('lease_id', $t->bail['lease']->id)->update(['valid_to' => '2026-09-01']));
    LR::terme($t->org, $t->bail['lease'], 'rent', [...LR::loyer(80000), 'valid_from' => '2026-09-01']);
}

it('borne la lecture de l\'ancien mandant à la fin de sa couverture : conditions, locataires et congé postérieurs masqués', function (): void {
    bailTransfere($this);
    $nouveau = T::colocataire($this->org, $this->bail['lease'], ['valid_from' => '2026-09-01']);
    L::dans($this->org, fn () => $this->bail['lease']->forceFill(['notice_received_on' => '2026-10-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2027-01-31'])->save());
    L::dans($this->org, fn () => $nouveau->forceFill(['display_name' => 'Nouveau Coloc'])->save());

    $detail = R::lire($this, $this->a['user'], '/leases/'.$this->bail['lease']->id)->assertOk();
    $liste = R::lire($this, $this->a['user'], '/leases')->assertOk();

    expect($detail->json('data.terms_on'))->toBe('2026-06-30')
        ->and(collect($detail->json('data.terms'))->pluck('amount.amount')->all())->toBe([65000])
        ->and(collect($detail->json('data.tenants'))->pluck('display_name')->all())->toBe(['Marie Durand'])
        ->and(collect($liste->json('data.0.tenants'))->pluck('display_name')->all())->toBe(['Marie Durand'])
        ->and($detail->json('data.notice'))->toBeNull()
        ->and($detail->json('data.phase'))->toBe('running')
        ->and($detail->json('data.end_date'))->toBe('2028-12-31')
        ->and(R::texte($detail))->not->toContain('Nouveau Coloc')->not->toContain('80000')->not->toContain('2027-01');
});

it('sert au nouveau mandant les conditions du jour, les colocataires en vigueur et le congé', function (): void {
    bailTransfere($this);
    $nouveau = T::colocataire($this->org, $this->bail['lease'], ['valid_from' => '2026-09-01']);
    L::dans($this->org, fn () => $nouveau->forceFill(['display_name' => 'Nouveau Coloc'])->save());
    L::dans($this->org, fn () => $this->bail['lease']->forceFill(['notice_received_on' => '2026-10-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2027-01-31'])->save());

    $detail = R::lire($this, $this->b['user'], '/leases/'.$this->bail['lease']->id)->assertOk();

    expect($detail->json('data.terms_on'))->toBe('2026-11-19')
        ->and(collect($detail->json('data.terms'))->pluck('amount.amount')->all())->toBe([80000])
        ->and(collect($detail->json('data.tenants'))->pluck('display_name')->all())->toContain('Marie Durand')->toContain('Nouveau Coloc')
        ->and($detail->json('data.notice.departure_on'))->toBe('2027-01-31')
        ->and($detail->json('data.phase'))->toBe('notice')
        ->and($detail->json('data.end_date'))->toBe('2027-01-30');
});

it('masque à l\'ancien mandant un congé reçu après la fin de sa couverture, même sans autre changement', function (): void {
    bailTransfere($this);
    L::dans($this->org, fn () => $this->bail['lease']->forceFill(['notice_received_on' => '2026-10-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2027-01-31'])->save());

    $liste = R::lire($this, $this->a['user'], '/leases')->assertOk();

    expect($liste->json('data.0.phase'))->toBe('running')->and($liste->json('data.0.end_date'))->toBe('2028-12-31');
});

it('garde le congé reçu pendant la couverture', function (): void {
    bailTransfere($this);
    L::dans($this->org, fn () => $this->bail['lease']->forceFill(['notice_received_on' => '2026-05-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2027-01-31'])->save());

    $detail = R::lire($this, $this->a['user'], '/leases/'.$this->bail['lease']->id)->assertOk();

    expect($detail->json('data.notice.received_on'))->toBe('2026-05-01')->and($detail->json('data.phase'))->toBe('notice');
});

it('ne sert à l\'ancien mandant ni les lots ni les colocataires venus après sa couverture quand le bail garde plusieurs lots', function (): void {
    bailTransfere($this);
    $autreLot = L::lot($this->org);
    LR::occuper($this->org, $this->bail['lease'], $autreLot, ['valid_from' => '2026-09-01', 'is_main' => false]);

    $detail = R::lire($this, $this->a['user'], '/leases/'.$this->bail['lease']->id)->assertOk();

    expect(R::texte($detail))->not->toContain($autreLot->id)->and($detail->json('data.units'))->toHaveCount(1);
});

it('ne sert que les lots de la clé d\'un bail partagé entre deux mandants, sans adresse, référence ni loyer global du lot de l\'autre', function (): void {
    $bail = R::bail($this->org, $this->a['unit']);
    $parking = $this->b['unit'];
    LR::occuper($this->org, $bail['lease'], $parking, ['valid_from' => '2026-01-01', 'is_main' => false]);

    $pourY = R::lire($this, $this->b['user'], '/leases/'.$bail['lease']->id)->assertOk();
    $listeY = R::lire($this, $this->b['user'], '/leases')->assertOk();
    $pourX = R::lire($this, $this->a['user'], '/leases/'.$bail['lease']->id)->assertOk();

    expect(R::texte($pourY))->not->toContain($this->a['unit']->id)->not->toContain($this->a['unit']->reference)->not->toContain('650')
        ->and(R::texte($listeY))->not->toContain($this->a['unit']->id)->not->toContain($this->a['unit']->reference)
        ->and($pourY->json('data.terms'))->toBe([])
        ->and($pourY->json('data.units'))->toHaveCount(1)
        ->and($pourY->json('data.units.0.unit.id'))->toBe($parking->id)
        ->and($pourY->json('data.main_unit'))->toBeNull()
        ->and($pourY->json('data.mandant.name'))->toBe($this->b['party']->display_name)
        ->and($pourX->json('data.units'))->toHaveCount(1)
        ->and($pourX->json('data.units.0.unit.id'))->toBe($this->a['unit']->id)
        ->and($pourX->json('data.terms'))->toBe([])
        ->and(R::texte($pourX))->not->toContain($parking->id)->not->toContain($parking->reference);
});

it('garde les conditions d\'un bail dont tous les lots sont dans la clé', function (): void {
    $bail = R::bail($this->org, $this->a['unit']);
    $cave = L::lot($this->org);
    L::dans($this->org, fn () => MandateUnit::factory()->create(['mandate_id' => $this->a['mandate']->id, 'unit_id' => $cave->id, 'valid_from' => '2026-01-01']));
    LR::occuper($this->org, $bail['lease'], $cave, ['valid_from' => '2026-01-01', 'is_main' => false]);

    $detail = R::lire($this, $this->a['user'], '/leases/'.$bail['lease']->id)->assertOk();

    expect($detail->json('data.units'))->toHaveCount(2)->and(collect($detail->json('data.terms'))->pluck('amount.amount')->all())->toBe([65000]);
});

it('ne rattrape pas un locataire venu après la couverture quand personne n\'est en place à la fin de celle-ci', function (): void {
    bailTransfere($this);
    $nouveau = T::colocataire($this->org, $this->bail['lease'], ['valid_from' => '2026-09-01']);
    L::dans($this->org, fn () => $nouveau->forceFill(['display_name' => 'Nouveau Coloc'])->save());
    L::dans($this->org, fn () => LeaseParty::query()->where('lease_id', $this->bail['lease']->id)->where('party_id', $this->bail['tenant']->id)->update(['valid_to' => '2026-06-01']));

    $noms = collect(R::lire($this, $this->a['user'], '/leases')->assertOk()->json('data.0.tenants'))->pluck('display_name')->all();

    expect($noms)->toBe(['Marie Durand']);
});
