<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext as X;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->base = "/api/v1/org/{$this->org->id}";
    $this->uuid = fn (): string => (string) Str::uuid7();
});

it('refuse un jeton opérateur, même détenu par un membre, sur les routes Planning, journal, liens fiche-bien, import et fuseau', function (): void {
    $jeton = X::jetonOperateur(M::membre($this->org, MemberRole::Admin));
    $id = ($this->uuid)();
    $routes = [
        ['get', '/planning/events?from=2026-12-01&to=2026-12-31'],
        ['get', "/planning/events/{$id}"],
        ['post', '/planning/events'],
        ['patch', "/planning/events/{$id}"],
        ['post', "/planning/events/{$id}/cancel"],
        ['get', '/planning/tasks'],
        ['get', "/planning/tasks/{$id}"],
        ['post', '/planning/tasks'],
        ['patch', "/planning/tasks/{$id}"],
        ['post', "/planning/tasks/{$id}/complete"],
        ['post', "/planning/tasks/{$id}/reopen"],
        ['post', "/planning/tasks/{$id}/cancel"],
        ['post', '/planning/tasks/bulk/complete'],
        ['post', '/planning/tasks/bulk/postpone'],
        ['post', '/planning/tasks/bulk/assign'],
        ['get', '/activity'],
        ['get', "/activity/{$id}"],
        ['get', '/activity/export'],
        ['get', "/properties/{$id}/contacts"],
        ['post', "/properties/{$id}/contacts"],
        ['delete', "/properties/{$id}/contacts/{$id}"],
        ['get', "/property-contacts?party={$id}"],
        ['post', '/parties/import'],
        ['patch', ''],
    ];

    foreach ($routes as [$methode, $chemin]) {
        X::changer();
        $this->withToken($jeton)->json($methode, $this->base.$chemin, [])->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});

it('couvre toutes les routes Planning par ce contrôle', function (): void {
    $routes = collect(Route::getRoutes()->getRoutes())->filter(fn ($r): bool => str_starts_with((string) $r->getName(), 'planning.'));

    expect($routes)->toHaveCount(15);
});
