<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Leases\LeasesSecurityContext as X;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->lot = L::lot($this->org);
    $this->partie = L::partie($this->org);
    $this->bail = R::bailSigne($this->org);
    $this->routes = X::routes();
});

it('refuse l\'écriture au comptable sur chaque route d\'écriture, sans rien modifier, et lui laisse toute la lecture', function (): void {
    $this->actingAs(L::membre($this->org, MemberRole::Accountant));
    activerDeuxFacteurs(auth()->user());
    $echecs = [];

    foreach ($this->routes as $route) {
        $reponse = X::appeler($this, $route, $this->org, $this->bail->id, $this->lot, $this->partie);
        $route['write']
            ? X::constater($echecs, 'comptable', $route, $reponse, 403, 'role_forbidden')
            : X::constater($echecs, 'comptable', $route, $reponse, 200, null);
    }

    expect($echecs)->toBe([])
        ->and(L::dans($this->org, fn () => Lease::query()->count()))->toBe(1)
        ->and(L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->lock_version))->toBe(1);
});

it('laisse le propriétaire, l\'administrateur et le gestionnaire atteindre chaque écriture', function (MemberRole $role): void {
    $compte = $role === MemberRole::Owner ? L::titulaire($this->org) : L::membre($this->org, $role);
    activerDeuxFacteurs($compte);
    $this->actingAs($compte);
    $inconnu = (string) Str::uuid7();
    $echecs = [];

    foreach (X::ecritures($this->routes) as $route) {
        $reponse = X::appeler($this, $route, $this->org, $inconnu, $this->lot, $this->partie);
        $route['name'] === 'leases.store'
            ? X::constater($echecs, $role->value, $route, $reponse, 201, null)
            : X::constater($echecs, $role->value, $route, $reponse, 404, 'lease_not_found');
    }

    expect($echecs)->toBe([]);
})->with([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager]);

it('limite le débit de chaque écriture à 60 appels par minute', function (): void {
    $this->actingAs(L::titulaire($this->org));
    $inconnu = (string) Str::uuid7();
    $echecs = [];

    foreach (X::ecritures($this->routes) as $route) {
        Cache::flush();
        $url = X::url($route, $this->org, $inconnu, $this->lot, $this->partie);
        $trop = 0;

        foreach (range(1, 60) as $i) {
            $trop += $this->json($route['method'], $url, [])->getStatusCode() === 429 ? 1 : 0;
        }

        $reponse = $this->json($route['method'], $url, []);

        if ($trop !== 0 || $reponse->getStatusCode() !== 429) {
            $echecs[] = "{$route['name']} : {$trop} refus avant la limite, soixante et unième appel {$reponse->getStatusCode()}";
        }
    }

    expect($echecs)->toBe([]);
});
