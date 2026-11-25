<?php

declare(strict_types=1);

use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Shared\Tenancy\AcrossOrganizations;
use Database\Seeders\MarketplaceDemoSeeder;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

it('crée six annonces publiées et illustratives dans l\'organisation désignée, sans doublon quand on le rejoue', function (): void {
    M::semer();
    $agence = C::organisation();
    config(['marketplace.demo_organization_id' => $agence->id]);

    $this->seed(MarketplaceDemoSeeder::class);
    $this->seed(MarketplaceDemoSeeder::class);

    expect(AcrossOrganizations::query(Listing::class)->where('status', ListingStatus::Published->value)->where('organization_id', $agence->id)->count())->toBe(6);
    $refs = $this->getJson('/api/v1/marketplace/listings')->assertOk()->assertJsonCount(6, 'data')->json('data.*.ref');
    expect($refs)->each->toMatch('/^[a-z2-9]{12}$/');
});

it('ne tourne que dans les environnements local et testing', function (string $environnement): void {
    M::semer();
    config(['marketplace.demo_organization_id' => C::organisation()->id]);
    app()->detectEnvironment(fn (): string => $environnement);

    expect(fn () => (new MarketplaceDemoSeeder)->run())->toThrow(RuntimeException::class);
    expect(AcrossOrganizations::query(Listing::class)->count())->toBe(0);
})->with(['production', 'staging', 'preview']);

it('exige une organisation désignée', function (): void {
    config(['marketplace.demo_organization_id' => null]);

    expect(fn () => (new MarketplaceDemoSeeder)->run())->toThrow(RuntimeException::class);
});
