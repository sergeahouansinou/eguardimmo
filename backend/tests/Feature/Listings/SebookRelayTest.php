<?php

declare(strict_types=1);

use App\Shared\Audit\AuditLog;
use App\Shared\Http\SebookRelay;
use Illuminate\Support\Facades\Log;

const CLE_RELAIS_SEBOOK_TEST = 'cle-de-relais-sebook-de-test-0123456789';
const LISTE_ANNONCES = '/api/v1/marketplace/listings';
const ANNONCE_INCONNUE = '/api/v1/marketplace/listings/aaaaaaaaaaaa';

beforeEach(function (): void {
    config(['marketplace.sebook_relay_key' => CLE_RELAIS_SEBOOK_TEST]);
});

/**
 * @return array<string, string>
 */
function enTetesSebook(?string $ip = null, string $cle = CLE_RELAIS_SEBOOK_TEST): array
{
    return ['X-Sebook-Relay-Key' => $cle] + ($ip === null ? [] : ['X-Sebook-Client-Ip' => $ip]);
}

it('compte les lectures relayées par visiteur : un visiteur insistant ne prive pas les autres', function (): void {
    for ($i = 0; $i < SebookRelay::LIMITE_VISITEUR_PAR_MINUTE; $i++) {
        $this->getJson(LISTE_ANNONCES, enTetesSebook('203.0.113.7'))
            ->assertOk()
            ->assertHeader('X-RateLimit-Limit', (string) SebookRelay::LIMITE_VISITEUR_PAR_MINUTE);
    }

    $this->getJson(LISTE_ANNONCES, enTetesSebook('203.0.113.7'))->assertTooManyRequests()->assertHeader('Retry-After');
    $this->getJson(ANNONCE_INCONNUE, enTetesSebook('203.0.113.7'))->assertTooManyRequests();
    $this->getJson(LISTE_ANNONCES, enTetesSebook('198.51.100.4'))->assertOk();
    $this->getJson(ANNONCE_INCONNUE, enTetesSebook('198.51.100.4'))->assertNotFound();
    $this->getJson(LISTE_ANNONCES)->assertOk();
});

it('compte les visiteurs IPv6 relayés par préfixe /64', function (): void {
    for ($i = 1; $i <= SebookRelay::LIMITE_VISITEUR_PAR_MINUTE; $i++) {
        $this->getJson(LISTE_ANNONCES, enTetesSebook('2001:db8:1:2::'.dechex($i)))->assertOk();
    }

    $this->getJson(LISTE_ANNONCES, enTetesSebook('2001:db8:1:2:ffff::1'))->assertTooManyRequests();
    $this->getJson(LISTE_ANNONCES, enTetesSebook('2001:db8:1:3::1'))->assertOk();
});

it('réserve un quota propre aux lectures du serveur de SeBook sans visiteur', function (?string $ip): void {
    for ($i = 0; $i < SebookRelay::LIMITE_SERVEUR_PAR_MINUTE; $i++) {
        $this->getJson(LISTE_ANNONCES, enTetesSebook($ip))->assertOk();
    }

    $this->getJson(LISTE_ANNONCES, enTetesSebook($ip))->assertTooManyRequests();
    $this->getJson(LISTE_ANNONCES, enTetesSebook('203.0.113.7'))->assertOk();
    $this->getJson(LISTE_ANNONCES)->assertOk();
})->with(['sans en-tête' => [null], 'adresse invalide' => ['pas-une-ip']]);

it('ignore l\'IP annoncée sans la bonne clé', function (?string $cleConfiguree, string $clePresentee): void {
    config(['marketplace.sebook_relay_key' => $cleConfiguree]);

    for ($i = 1; $i <= 60; $i++) {
        $this->getJson(LISTE_ANNONCES, enTetesSebook('198.51.100.'.$i, $clePresentee))->assertOk();
    }

    $this->getJson(LISTE_ANNONCES, enTetesSebook('203.0.113.7', $clePresentee))->assertTooManyRequests();
})->with([
    'mauvaise clé' => [CLE_RELAIS_SEBOOK_TEST, 'une-autre-cle-de-relais-tout-aussi-longue'],
    'clé présentée vide' => [CLE_RELAIS_SEBOOK_TEST, ''],
    'relais non configuré' => [null, CLE_RELAIS_SEBOOK_TEST],
    'clé configurée trop courte' => ['cle-courte', 'cle-courte'],
]);

it('signale une clé refusée une fois par minute, sans jamais l\'écrire', function (?string $cleConfiguree, string $clePresentee): void {
    config(['marketplace.sebook_relay_key' => $cleConfiguree]);
    Log::spy();

    $this->getJson(LISTE_ANNONCES, enTetesSebook('203.0.113.7', $clePresentee))->assertOk();
    $this->getJson(ANNONCE_INCONNUE, enTetesSebook('203.0.113.7', $clePresentee))->assertNotFound();

    Log::shouldHaveReceived('warning')->once()->withArgs(fn (mixed ...$arguments): bool => $arguments === [SebookRelay::MESSAGE_CLE_REFUSEE]);

    $this->travel(61)->seconds();
    $this->getJson(LISTE_ANNONCES, enTetesSebook('203.0.113.7', $clePresentee))->assertOk();

    Log::shouldHaveReceived('warning')->twice();
})->with([
    'mauvaise clé' => [CLE_RELAIS_SEBOOK_TEST, 'une-autre-cle-de-relais-tout-aussi-longue'],
    'relais non configuré' => [null, CLE_RELAIS_SEBOOK_TEST],
    'clé configurée trop courte' => ['cle-courte', 'cle-courte'],
]);

it('ne signale rien sans clé présentée ni avec la bonne clé', function (array $enTetes): void {
    Log::spy();

    $this->getJson(LISTE_ANNONCES, $enTetes)->assertOk();

    Log::shouldNotHaveReceived('warning');
})->with([
    'sans en-tête' => [[]],
    'en-tête vide' => [['X-Sebook-Relay-Key' => '']],
    'bonne clé' => [['X-Sebook-Relay-Key' => CLE_RELAIS_SEBOOK_TEST]],
]);

it('n\'accepte pas la clé hors de la liste et du détail des annonces', function (string $methode, string $uri, int $plafond): void {
    for ($i = 1; $i <= $plafond; $i++) {
        $reponse = $this->json($methode, $uri, ['email' => "essai{$i}@exemple.fr", 'password' => 'faux', 'device_name' => 'iPhone'], enTetesSebook('198.51.100.'.$i));

        expect($reponse->status())->not->toBe(429);
    }

    $this->json($methode, $uri, ['email' => 'encore@exemple.fr', 'password' => 'faux', 'device_name' => 'iPhone'], enTetesSebook('203.0.113.7'))
        ->assertTooManyRequests();
})->with([
    'connexion' => ['POST', '/api/v1/auth/token', 20],
    'recherche de communes' => ['GET', '/api/v1/marketplace/places?q=ly', 30],
    'disponibilités' => ['GET', '/api/v1/marketplace/listings/aaaaaaaaaaaa/availability', 60],
]);

it('n\'écrit jamais l\'IP relayée par SeBook dans le journal d\'audit', function (): void {
    $this->postJson('/api/v1/auth/token', ['email' => 'inconnu@exemple.fr', 'password' => 'faux', 'device_name' => 'iPhone'], enTetesSebook('203.0.113.7'))
        ->assertUnprocessable();

    expect(AuditLog::query()->whereNotNull('route')->pluck('ip')->unique()->values()->all())->toBe(['127.0.0.1']);
});
