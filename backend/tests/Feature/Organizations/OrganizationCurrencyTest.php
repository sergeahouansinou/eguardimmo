<?php

declare(strict_types=1);

use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Support\OrganizationCurrency;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
});

it('expose la devise du siège dans la ressource organisation, sans changer les autres champs', function (): void {
    $reponse = $this->actingAs($this->titulaire)->getJson("/api/v1/org/{$this->org->id}")->assertOk();

    expect($reponse->json('data'))->toBe([
        'id' => $this->org->id,
        'kind' => 'agency',
        'name' => 'Agence du Port',
        'country' => 'FR',
        'currency' => 'EUR',
        'timezone' => 'Europe/Paris',
        'two_factor_required' => false,
    ]);
});

it('dérive la devise du pays par la source des autres modules : EUR pour FR, BE et LU, CAD pour le Canada', function (string $pays, string $devise): void {
    Organization::query()->whereKey($this->org->id)->update(['country' => $pays]);

    $this->actingAs($this->titulaire)->getJson("/api/v1/org/{$this->org->id}")
        ->assertOk()->assertJsonPath('data.country', $pays)->assertJsonPath('data.currency', $devise);
    expect(OrganizationCurrency::of($pays)->getCode())->toBe($devise);
})->with([['FR', 'EUR'], ['BE', 'EUR'], ['LU', 'EUR'], ['CA', 'CAD']]);

it('porte la devise sur la création, la modification du fuseau et la politique de sécurité', function (): void {
    $this->actingAs($this->titulaire)->patchJson("/api/v1/org/{$this->org->id}", ['timezone' => 'Europe/Paris'])
        ->assertOk()->assertJsonPath('data.currency', 'EUR');
    $this->actingAs($this->titulaire)->putJson("/api/v1/org/{$this->org->id}/security", ['two_factor_required' => true])
        ->assertOk()->assertJsonPath('data.currency', 'EUR');
});

it('refuse de deviner une devise pour un pays sans juridiction ouverte : aucune devise XOF', function (): void {
    expect(fn () => OrganizationCurrency::of('BJ'))->toThrow(LogicException::class);
});
