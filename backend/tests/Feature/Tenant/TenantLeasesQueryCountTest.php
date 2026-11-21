<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    $this->travelTo(CarbonImmutable::parse(T::AUJOURDHUI));
    $this->org = T::organisation();
    $this->compte = User::factory()->create();
    $this->semer = function (int $nombre, $org = null) use (&$premier): void {
        foreach (range(1, $nombre) as $i) {
            T::locataire($org ?? $this->org, ['reference' => sprintf('BL-2026-%04d', random_int(1000, 9999))], [], $this->compte);
        }
    };
    $this->requetes = function (string $url): int {
        T::comme($this, $this->compte);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson($url)->assertOk();
        $total = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $total;
    };
});

it('liste les baux en un nombre de requêtes indépendant du nombre de baux d\'une organisation', function (): void {
    ($this->semer)(2);
    $peu = ($this->requetes)('/api/v1/tenant/leases?per_page=100');

    ($this->semer)(8);
    $beaucoup = ($this->requetes)('/api/v1/tenant/leases?per_page=100');

    expect($beaucoup)->toBe($peu)->and($beaucoup)->toBeLessThanOrEqual(25);
});

it('ne fait croître la lecture qu\'avec le nombre d\'organisations, pas de baux', function (): void {
    ($this->semer)(3);
    $autre = T::organisation('Immo Loire');
    ($this->semer)(3, $autre);
    $deux = ($this->requetes)('/api/v1/tenant/leases?per_page=100');

    ($this->semer)(6);
    ($this->semer)(6, $autre);

    expect(($this->requetes)('/api/v1/tenant/leases?per_page=100'))->toBe($deux);
});

it('lit le détail en un nombre de requêtes indépendant du nombre de parties et de composantes', function (): void {
    $moi = T::locataire($this->org, [], [], $this->compte);
    $url = "/api/v1/tenant/leases/{$moi['lease']->id}";
    $peu = ($this->requetes)($url);

    foreach (range(1, 5) as $i) {
        T::colocataire($this->org, $moi['lease']);
    }
    R::terme($this->org, $moi['lease'], 'charges_provision', [...R::loyer(8000), 'valid_from' => '2026-01-01']);
    R::terme($this->org, $moi['lease'], 'rent_supplement', [...R::loyer(2000), 'valid_from' => '2026-01-01']);

    expect(($this->requetes)($url))->toBe($peu)->and($peu)->toBeLessThanOrEqual(30);
});
