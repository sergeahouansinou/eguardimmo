<?php

declare(strict_types=1);

use App\Modules\Identity\Data\ProfileData;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use Illuminate\Support\Facades\Route;
use Tests\Feature\Documents\DocumentsContext as D;

it('refuse tout /org/{o}/documents à un compte locataire ou propriétaire, sans rien révéler de l\'organisation', function (Space $espace): void {
    $org = D::organisation();
    $compte = User::factory()->create();
    app(ProfileRegistry::class)->register(
        fn (string $id): array => $id === $compte->id ? [new ProfileData($espace, 'Profil', [])] : [],
    );
    $uuid = fake()->uuid();

    $this->actingAs($compte);

    $appels = [
        ['getJson', D::url($org, "/files/{$uuid}/download")],
        ['getJson', D::url($org, '/certificates')],
        ['getJson', D::url($org, "/certificates/{$uuid}")],
        ['postJson', D::url($org, '/files')],
        ['postJson', D::url($org, '/certificates')],
        ['postJson', D::url($org, "/certificates/{$uuid}/renew")],
        ['getJson', D::url($org, '/library')],
        ['postJson', D::url($org, '/library')],
        ['postJson', D::url($org, "/library/{$uuid}/archive")],
        ['deleteJson', D::url($org, "/library/{$uuid}/archive")],
    ];

    foreach ($appels as [$methode, $url]) {
        $this->{$methode}($url, in_array($methode, ['postJson'], true) ? ['file' => D::pdf()] : [])
            ->assertNotFound()
            ->assertJsonPath('code', 'organization_not_found');
    }
})->with([
    'locataire' => [Space::Tenant],
    'propriétaire' => [Space::Owner],
]);

it('place space:organization et auth:sanctum sur chaque route /org/{o}/documents', function (): void {
    $routes = collect(Route::getRoutes()->getRoutes())->filter(fn ($route): bool => str_contains($route->uri(), '/documents') && str_starts_with($route->uri(), 'api/v1/org/'));

    expect($routes)->not->toBeEmpty();

    foreach ($routes as $route) {
        expect($route->gatherMiddleware())->toContain('space:organization')->toContain('auth:sanctum');
    }
});

it('ouvre /org/{o}/documents au titulaire de l\'organisation', function (): void {
    $org = D::organisation();

    $this->actingAs(D::titulaire($org))->getJson(D::url($org, '/certificates'))->assertOk();
});
