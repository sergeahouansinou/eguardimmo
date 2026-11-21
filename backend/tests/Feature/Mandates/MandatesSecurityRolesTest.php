<?php

declare(strict_types=1);

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext as X;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->mandat = M::actif($this->org, $this->lot, $this->partie);
    $this->routes = X::routes();
});

it('refuse l\'écriture au comptable sur chaque route d\'écriture, sans rien modifier, et lui laisse toute la lecture', function (): void {
    $this->actingAs(M::membre($this->org, MemberRole::Accountant));
    $echecs = [];

    foreach ($this->routes as $route) {
        $reponse = X::appeler($this, $route, $this->org, $this->mandat->id, $this->lot, $this->partie);
        $route['write'] || $route['name'] === 'mandates.documents.index'
            ? X::constater($echecs, 'comptable', $route, $reponse, 403, 'role_forbidden')
            : X::constater($echecs, 'comptable', $route, $reponse, 200, null);
    }

    expect($echecs)->toBe([])
        ->and(M::dans($this->org, fn () => Mandate::query()->count()))->toBe(1)
        ->and(M::dans($this->org, fn () => Mandate::query()->findOrFail($this->mandat->id)->lock_version))->toBe(1);
});

it('laisse le propriétaire, l\'administrateur et le gestionnaire atteindre chaque écriture', function (MemberRole $role): void {
    $this->actingAs($role === MemberRole::Owner ? M::titulaire($this->org) : M::membre($this->org, $role));
    $inconnu = (string) Str::uuid7();
    $echecs = [];

    foreach (X::ecritures($this->routes) as $route) {
        $reponse = X::appeler($this, $route, $this->org, $inconnu, $this->lot, $this->partie);
        $route['name'] === 'mandates.store'
            ? X::constater($echecs, $role->value, $route, $reponse, 201, null)
            : X::constater($echecs, $role->value, $route, $reponse, 404, 'mandate_not_found');
    }

    expect($echecs)->toBe([]);
})->with([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager]);

it('limite le débit de chaque écriture à 60 appels par minute', function (): void {
    $this->actingAs(M::titulaire($this->org));
    $inconnu = (string) Str::uuid7();
    $echecs = [];

    foreach (X::ecritures($this->routes) as $route) {
        Cache::flush();
        $url = X::url($route, $this->org, $inconnu);
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

it('limite le débit des lectures à 120 appels par minute', function (): void {
    $this->actingAs(M::titulaire($this->org));
    Cache::flush();
    $trop = 0;

    foreach (range(1, 120) as $i) {
        $trop += $this->getJson(M::url($this->org))->getStatusCode() === 429 ? 1 : 0;
    }

    expect($trop)->toBe(0)->and($this->getJson(M::url($this->org))->getStatusCode())->toBe(429);
});
