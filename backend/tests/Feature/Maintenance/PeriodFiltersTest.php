<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    C::comme($this, $this->scene['owner']);
    $this->url = C::url($this->scene['org'], '/interventions');
    $this->creer = function (string $echeance): string {
        $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
        DB::table('interventions')->where('id', $id)->update(['due_on' => $echeance]);

        return $id;
    };
    $this->visite = function (string $intervention, string $jour): void {
        DB::table('intervention_visits')->insert([
            'id' => (string) Str::uuid7(), 'organization_id' => $this->scene['org']->id, 'intervention_id' => $intervention, 'scheduled_on' => $jour,
            'slot' => 'morning', 'status' => 'confirmed', 'created_at' => now(), 'updated_at' => now(),
        ]);
    };
    $this->ids = function (string $requete): array {
        C::comme($this, $this->scene['owner']);

        return $this->getJson("{$this->url}?{$requete}")->assertOk()->json('data.*.id');
    };
});

it('filtre par échéance sur une période semi-ouverte', function (): void {
    $a = ($this->creer)('2026-12-01');
    $b = ($this->creer)('2026-12-10');
    $c = ($this->creer)('2026-12-20');

    expect(($this->ids)('due_from=2026-12-01&due_to=2026-12-10'))->toBe([$a])
        ->and(($this->ids)('due_from=2026-12-10&due_to=2026-12-11'))->toBe([$b])
        ->and(($this->ids)('due_from=2026-12-10'))->toEqualCanonicalizing([$b, $c])
        ->and(($this->ids)('due_to=2026-12-10'))->toBe([$a])
        ->and(($this->ids)('due_from=2027-01-01'))->toBe([])
        ->and(($this->ids)(''))->toHaveCount(3);
});

it('retient aussi l\'intervention dont une visite tombe dans la période', function (): void {
    $sansVisite = ($this->creer)('2026-12-01');
    $avecVisite = ($this->creer)('2027-03-01');
    ($this->visite)($avecVisite, '2026-12-15');

    expect(($this->ids)('due_from=2026-12-14&due_to=2026-12-16'))->toBe([$avecVisite])
        ->and(($this->ids)('due_from=2026-12-15&due_to=2026-12-16'))->toBe([$avecVisite])
        ->and(($this->ids)('due_from=2026-12-10&due_to=2026-12-15'))->toBe([])
        ->and(($this->ids)('due_from=2026-12-16&due_to=2026-12-17'))->toBe([])
        ->and(($this->ids)('due_from=2026-11-30&due_to=2026-12-02'))->toBe([$sansVisite]);
});

it('combine la période avec les autres filtres et ne sort jamais d\'organisation', function (): void {
    $mienne = ($this->creer)('2026-12-01');
    $autre = C::agence();
    C::comme($this, $autre['owner']);
    $etrangere = (string) C::signaler($this, $autre)->assertCreated()->json('data.id');
    DB::table('interventions')->where('id', $etrangere)->update(['due_on' => '2026-12-01']);
    C::comme($this, $this->scene['owner']);

    expect(($this->ids)('due_from=2026-12-01&due_to=2026-12-02'))->toBe([$mienne])
        ->and(($this->ids)('due_from=2026-12-01&due_to=2026-12-02&status=reported'))->toBe([$mienne])
        ->and(($this->ids)('due_from=2026-12-01&due_to=2026-12-02&status=closed'))->toBe([]);
});

it('refuse une période invalide', function (string $requete, string $champ): void {
    $this->getJson("{$this->url}?{$requete}")->assertUnprocessable()->assertJsonValidationErrors([$champ]);
})->with([
    'date mal formée' => ['due_from=01/12/2026', 'due_from'],
    'fin avant le début' => ['due_from=2026-12-10&due_to=2026-12-01', 'due_to'],
    'fin égale au début' => ['due_from=2026-12-10&due_to=2026-12-10', 'due_to'],
    'hors bornes' => ['due_to=2101-01-01', 'due_to'],
    'tableau' => ['due_from[]=2026-12-01', 'due_from'],
]);
