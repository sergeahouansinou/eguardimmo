<?php

declare(strict_types=1);

use App\Modules\Leases\Support\UnitOccupancyLock;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;

const LEASE_LOT_A = '01934f6e-0000-7000-8000-00000000000a';
const LEASE_LOT_B = '01934f6e-0000-7000-8000-00000000000b';
const LEASE_LOT_C = '01934f6e-0000-7000-8000-00000000000c';

beforeEach(function (): void {
    $this->org = L::organisation();
    $this->verrou = app(UnitOccupancyLock::class);
    $this->ordre = function (array $lots): array {
        $vus = [];
        DB::listen(function ($requete) use (&$vus): void {
            if (str_contains($requete->sql, 'insert into "lease_unit_locks"')) {
                $vus[] = $requete->bindings[1];
            }
        });
        L::dans($this->org, fn () => DB::transaction(fn () => $this->verrou->acquire($lots)));

        return $vus;
    };
});

it('verrouille les lots dans l\'ordre croissant de leurs identifiants, quel que soit l\'ordre demandé', function (): void {
    expect(($this->ordre)([LEASE_LOT_C, LEASE_LOT_A, LEASE_LOT_B]))->toBe([LEASE_LOT_A, LEASE_LOT_B, LEASE_LOT_C]);
});

it('ne verrouille qu\'une fois un lot répété', function (): void {
    expect(($this->ordre)([LEASE_LOT_B, LEASE_LOT_A, LEASE_LOT_B]))->toBe([LEASE_LOT_A, LEASE_LOT_B]);
});

it('crée la ligne de verrou au premier passage puis la réutilise', function (): void {
    ($this->ordre)([LEASE_LOT_B, LEASE_LOT_A]);
    ($this->ordre)([LEASE_LOT_A]);

    $valeurs = DB::table('lease_unit_locks')->where('organization_id', $this->org->id)->pluck('last_value', 'unit_id')->all();

    expect($valeurs)->toBe([LEASE_LOT_A => 2, LEASE_LOT_B => 1]);
});

it('cloisonne les verrous par organisation', function (): void {
    $autre = L::organisation();
    ($this->ordre)([LEASE_LOT_A]);
    L::dans($autre, fn () => DB::transaction(fn () => $this->verrou->acquire([LEASE_LOT_A])));

    expect(DB::table('lease_unit_locks')->where('unit_id', LEASE_LOT_A)->count())->toBe(2)
        ->and(DB::table('lease_unit_locks')->where('organization_id', $autre->id)->value('last_value'))->toBe(1);
});

it('ne fait rien pour une liste vide', function (): void {
    expect(($this->ordre)([]))->toBe([])
        ->and(DB::table('lease_unit_locks')->count())->toBe(0);
});
