<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\LeaseUnit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    Storage::fake('documents');
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
});

it('refuse un bail signé qui occupe déjà le lot : période recoupée, à durée limitée ou reconduit', function (): void {
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($this->org);
    $existant = S::bailSigneSur($this->org, $lot, ['starts_on' => '2025-01-01'], reconduit: true);

    S::refus($this, $bail, 'lease_overlap', 409);

    L::dans($this->org, fn () => $existant->forceFill(['ends_on' => '2026-06-01'])->save());
    S::refus($this, $bail, 'lease_overlap', 409);
});

it('admet un bail qui commence à la fin exacte du précédent, ends_on étant exclu', function (): void {
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($this->org);
    S::bailSigneSur($this->org, $lot, ['starts_on' => '2023-01-01', 'ends_on' => '2026-01-01']);

    expect(S::appliquer($this, $bail)->status)->toBe(LeaseStatus::Signed);
});

it('libère le lot à la date de départ du préavis du bail en cours', function (): void {
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($this->org, ['starts_on' => '2026-09-01']);
    $existant = S::bailSigneSur($this->org, $lot, ['starts_on' => '2025-01-01'], reconduit: true);
    L::dans($this->org, fn () => $existant->forceFill([
        'notice_received_on' => '2026-05-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2026-09-01', 'termination_reason' => 'Mutation',
    ])->save());

    expect(S::appliquer($this, $bail)->status)->toBe(LeaseStatus::Signed);
});

it('compte un bail résilié avec une fin connue tant que cette fin n\'est pas atteinte', function (): void {
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($this->org, ['starts_on' => '2026-03-01']);
    S::bailSigneSur($this->org, $lot, ['status' => LeaseStatus::Terminated, 'starts_on' => '2025-01-01', 'ends_on' => '2026-04-01']);

    S::refus($this, $bail, 'lease_overlap', 409);
});

it('admet un brouillon, un bail annulé ou une ligne de lot fermée qui chevauche', function (): void {
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($this->org);
    L::bail($this->org, ['status' => LeaseStatus::Draft, 'starts_on' => '2026-01-01']);
    $autreBrouillon = L::bail($this->org, ['starts_on' => '2026-01-01']);
    R::occuper($this->org, $autreBrouillon, $lot);
    $annule = L::bail($this->org, ['status' => LeaseStatus::Cancelled, 'signed_on' => '2025-12-01', 'starts_on' => '2026-01-01']);
    R::occuper($this->org, $annule, $lot);
    $ancien = S::bailSigneSur($this->org, $lot, ['starts_on' => '2025-01-01', 'ends_on' => '2030-01-01']);
    L::dans($this->org, fn () => LeaseUnit::query()->where('lease_id', $ancien->id)->get()->each->update(['valid_to' => '2026-01-01']));

    expect(S::appliquer($this, $bail)->status)->toBe(LeaseStatus::Signed);
});

it('ne regarde que ses lots : un bail signé sur un autre lot ne gêne pas, ni celui d\'une autre organisation', function (): void {
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($this->org);
    S::bailSigneSur($this->org, L::lot($this->org), reconduit: true);
    $autre = L::organisation();
    S::bailSigneSur($autre, $lot, reconduit: true);

    expect(S::appliquer($this, $bail)->status)->toBe(LeaseStatus::Signed);
});

it('refuse si un seul des lots du bail est déjà occupé', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);
    $annexe = L::lot($this->org);
    R::occuper($this->org, $bail, $annexe, ['is_main' => false]);
    S::bailSigneSur($this->org, $annexe, reconduit: true);

    S::refus($this, $bail, 'lease_overlap', 409);
});

it('verrouille tous les lots dans l\'ordre croissant de leurs identifiants avant de relire les occupations', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);
    $lots = [L::lot($this->org), L::lot($this->org), L::lot($this->org)];
    foreach (array_reverse($lots) as $lot) {
        R::occuper($this->org, $bail, $lot, ['is_main' => false]);
    }
    $attendu = collect([...array_map(fn ($l): string => $l->id, $lots), ...L::dans($this->org, fn () => LeaseUnit::query()->where('lease_id', $bail->id)->pluck('unit_id')->all())])->unique()->sort()->values()->all();

    $evenements = [];
    DB::listen(function ($requete) use (&$evenements): void {
        if (str_contains($requete->sql, 'insert into "lease_unit_locks"')) {
            $evenements[] = 'verrou:'.$requete->bindings[1];
        } elseif (str_contains($requete->sql, 'from "lease_units"') && str_contains($requete->sql, '"unit_id" in')) {
            $evenements[] = 'lecture';
        }
    });

    S::appliquer($this, $bail);

    expect($evenements)->toBe([...array_map(fn (string $id): string => "verrou:{$id}", $attendu), 'lecture']);
});

it('relit les occupations après le verrou : un bail concurrent validé entre-temps est vu', function (): void {
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($this->org);

    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau, $lot): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "lease_unit_locks"')) {
            return;
        }

        $declenchee = true;
        S::insererBailSigne($this->org->id, $lot->id);
    });

    $this->postJson(S::url($this, $bail->id), S::corps($bail))->assertConflict()->assertJsonPath('code', 'lease_overlap');

    expect($declenchee)->toBeTrue()
        ->and(DB::table('leases')->where('id', $bail->id)->value('status'))->toBe('draft')
        ->and(DB::table('lease_unit_locks')->where('unit_id', $lot->id)->count())->toBe(0);
});

it('signe sans conflit quand rien d\'autre n\'arrive entre le verrou et la relecture', function (): void {
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($this->org);

    $this->postJson(S::url($this, $bail->id), S::corps($bail))->assertOk();

    expect(DB::table('lease_unit_locks')->where('unit_id', $lot->id)->value('last_value'))->toBe(1);
});

it('ne signe pas deux fois : la seconde tentative voit un bail signé', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);

    $this->postJson(S::url($this, $bail->id), S::corps($bail))->assertOk();
    $this->postJson(S::url($this, $bail->id), S::corps($bail))->assertConflict()->assertJsonPath('code', 'lease_not_draft');
});
