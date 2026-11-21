<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;

function creerOrganisationsDuCompte(User $compte, int $nombre): void
{
    for ($i = 0; $i < $nombre; $i++) {
        app(CreateOrganization::class)->handle($compte, new NewOrganizationData(OrganizationKind::Individual, "Mes biens {$i}", 'FR'), 'Awa', 'Diallo');
    }
}

function corpsCreationOrganisation(): array
{
    return ['kind' => 'individual', 'name' => 'Une de plus', 'country' => 'FR', 'first_name' => 'Awa', 'last_name' => 'Diallo'];
}

function nombreOrganisationsPossedees(User $compte): int
{
    return Organization::query()->where('created_by_user_id', $compte->id)->count();
}

it('crée une organisation sous le plafond par défaut de cinq', function (): void {
    $compte = User::factory()->create();
    creerOrganisationsDuCompte($compte, 4);

    $this->actingAs($compte)->postJson('/api/v1/organizations', corpsCreationOrganisation())->assertCreated();

    expect(nombreOrganisationsPossedees($compte))->toBe(5);
});

it('refuse la sixième avec 403 organization_limit_reached lisible, sans rien créer', function (): void {
    $compte = User::factory()->create();
    creerOrganisationsDuCompte($compte, 5);

    $reponse = $this->actingAs($compte)->postJson('/api/v1/organizations', corpsCreationOrganisation())->assertForbidden();

    expect($reponse->json())->toMatchArray(['code' => 'organization_limit_reached', 'status' => 403, 'title' => 'Limite d\'organisations atteinte'])
        ->and($reponse->json('detail'))->toContain('nombre maximal d\'organisations')
        ->and($reponse->headers->get('Content-Type'))->toContain('application/problem+json')
        ->and(nombreOrganisationsPossedees($compte))->toBe(5);
});

it('refuse aussi par l\'Action, qui sert les créations internes', function (): void {
    $compte = User::factory()->create();
    creerOrganisationsDuCompte($compte, 5);

    expect(fn () => creerOrganisationsDuCompte($compte, 1))
        ->toThrow(fn (ApiProblem $p) => expect([$p->problemCode, $p->status])->toBe(['organization_limit_reached', 403]));
});

it('règle le plafond par configuration', function (): void {
    config(['organizations.creation.max_owned_per_user' => 2]);
    $compte = User::factory()->create();
    creerOrganisationsDuCompte($compte, 2);

    $this->actingAs($compte)->postJson('/api/v1/organizations', corpsCreationOrganisation())->assertForbidden()->assertJsonPath('code', 'organization_limit_reached');

    config(['organizations.creation.max_owned_per_user' => 3]);
    $this->actingAs($compte)->postJson('/api/v1/organizations', corpsCreationOrganisation())->assertCreated();
});

it('compte par compte : le plafond d\'un utilisateur ne touche ni un autre ni les organisations dont il est seulement membre', function (): void {
    $plein = User::factory()->create();
    $autre = User::factory()->create();
    creerOrganisationsDuCompte($plein, 5);
    creerOrganisationsDuCompte($autre, 4);

    $this->actingAs($plein)->postJson('/api/v1/organizations', corpsCreationOrganisation())->assertForbidden();
    $this->actingAs($autre)->postJson('/api/v1/organizations', corpsCreationOrganisation())->assertCreated();
    expect(nombreOrganisationsPossedees($autre))->toBe(5);

    $membreSeulement = User::factory()->create();
    creerOrganisationsDuCompte($membreSeulement, 4);
    app(CurrentOrganization::class)->run(
        Organization::query()->where('created_by_user_id', $plein->id)->firstOrFail()->id,
        fn () => OrganizationMember::query()->create([
            'user_id' => $membreSeulement->id, 'email' => mb_strtolower($membreSeulement->email), 'first_name' => 'M', 'last_name' => 'S',
            'role' => MemberRole::Manager, 'status' => MemberStatus::Active, 'joined_at' => now(),
        ]),
    );

    $this->actingAs($membreSeulement)->postJson('/api/v1/organizations', corpsCreationOrganisation())->assertCreated();
});

it('ignore tout identifiant de créateur envoyé par le client', function (): void {
    $plein = User::factory()->create();
    $victime = User::factory()->create();
    creerOrganisationsDuCompte($plein, 5);

    $this->actingAs($plein)->postJson('/api/v1/organizations', [...corpsCreationOrganisation(), 'created_by_user_id' => $victime->id])->assertForbidden();
    expect(nombreOrganisationsPossedees($victime))->toBe(0);
});
