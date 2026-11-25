<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Models\PlatformCampaign;
use Tests\Feature\Console\ConsoleContext;
use Tests\Feature\Notifications\PlatformContext as P;

dataset('routes de la plateforme', [
    'options' => ['GET', '/marketing/options', []],
    'liste' => ['GET', '/marketing/campaigns', []],
    'création' => ['POST', '/marketing/campaigns', P::email()],
    'fiche' => ['GET', '/marketing/campaigns/{id}', []],
    'modification' => ['POST', '/marketing/campaigns/{id}', P::email(['lock_version' => 1])],
    'image' => ['GET', '/marketing/campaigns/{id}/images/'.ConsoleContext::UUID_INCONNU, []],
    'estimation' => ['GET', '/marketing/campaigns/{id}/estimate', []],
    'essai' => ['POST', '/marketing/campaigns/{id}/test', []],
    'envoi' => ['POST', '/marketing/campaigns/{id}/send', ['lock_version' => 1]],
    'types' => ['GET', '/notifications/types', []],
    'réglage des types' => ['PUT', '/notifications/types', ['changes' => [['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => false]]]],
    'rappels' => ['GET', '/notifications/reminders', []],
    'réglage d\'un rappel' => ['PUT', '/notifications/reminders/rent_unpaid', ['enabled' => true, 'delay_days' => 5, 'repeat_every_days' => 7, 'max_occurrences' => 3, 'channels' => ['email']]],
]);

beforeEach(function (): void {
    $this->operateur = P::preparer($this);
    $this->campagne = P::creer($this, $this->operateur['jeton'], P::email());
});

it('exige un jeton', function (string $methode, string $chemin, array $corps): void {
    ConsoleContext::reinitialiser($this);

    $this->json($methode, P::CONSOLE.str_replace('{id}', $this->campagne, $chemin), $corps)->assertUnauthorized();
})->with('routes de la plateforme');

it('refuse une session web, même d\'un administrateur de la plateforme', function (string $methode, string $chemin, array $corps): void {
    auth()->forgetGuards();

    $this->actingAs($this->operateur['user'])->json($methode, P::CONSOLE.str_replace('{id}', $this->campagne, $chemin), $corps)->assertForbidden();
})->with('routes de la plateforme');

it('refuse un opérateur sans le rôle administrateur', function (string $methode, string $chemin, array $corps): void {
    $support = ConsoleContext::operateur(['support', 'billing', 'compliance', 'engineering']);

    ConsoleContext::ecrire($this, $support['jeton'], $methode, P::CONSOLE.str_replace('{id}', $this->campagne, $chemin), $corps)->assertForbidden();
})->with('routes de la plateforme');

it('refuse une écriture sans preuve de double authentification, sans rien changer', function (string $methode, string $chemin, array $corps): void {
    if ($methode === 'GET') {
        ConsoleContext::lire($this, $this->operateur['jeton'], P::CONSOLE.'/marketing/options')->assertOk()->assertHeader('Cache-Control', 'no-store, private');

        return;
    }

    ConsoleContext::ecrireBrut($this, $this->operateur['jeton'], $methode, P::CONSOLE.str_replace('{id}', $this->campagne, $chemin), $corps)
        ->assertUnprocessable()->assertJsonPath('code', 'operator_proof_required');
    ConsoleContext::ecrireBrut($this, $this->operateur['jeton'], $methode, P::CONSOLE.str_replace('{id}', $this->campagne, $chemin), [...$corps, 'two_factor_code' => '000000'])
        ->assertUnprocessable()->assertJsonPath('code', 'operator_proof_invalid');

    expect(PlatformCampaign::query()->count())->toBe(1)->and(PlatformCampaign::query()->firstOrFail()->status->value)->toBe('draft');
})->with('routes de la plateforme');

it('répond 404 à une campagne inconnue', function (string $methode, string $suite, array $corps): void {
    ConsoleContext::ecrire($this, $this->operateur['jeton'], $methode, P::URL.'/'.ConsoleContext::UUID_INCONNU.$suite, $corps)
        ->assertNotFound()->assertJsonPath('code', 'platform_campaign_not_found');
})->with([
    'fiche' => ['GET', '', []],
    'modification' => ['POST', '', P::email(['lock_version' => 1])],
    'image' => ['GET', '/images/'.ConsoleContext::UUID_INCONNU, []],
    'estimation' => ['GET', '/estimate', []],
    'essai' => ['POST', '/test', []],
    'envoi' => ['POST', '/send', ['lock_version' => 1]],
]);

it('répond 404 à un rappel inconnu', function (): void {
    ConsoleContext::ecrire($this, $this->operateur['jeton'], 'PUT', P::CONSOLE.'/notifications/reminders/inconnu', ['enabled' => true])
        ->assertNotFound()->assertJsonPath('code', 'reminder_not_found');
});

it('refuse un compte sans rôle opérateur', function (): void {
    $jeton = User::factory()->create()->createToken('mobile', ['mobile'])->plainTextToken;

    ConsoleContext::lire($this, $jeton, P::URL)->assertForbidden();
});
