<?php

declare(strict_types=1);

use App\Modules\Identity\Support\Hub;

it('accepte une adresse de retour d\'un hôte autorisé', function (string $url): void {
    expect(Hub::isAllowedReturnTo($url))->toBeTrue()
        ->and(Hub::safeReturnTo($url))->toBe($url);
})->with([
    'https://agence.eguardimmo.test/tableau',
    'https://AUTH.eguardimmo.test/',
    'https://proprietaire.eguardimmo.test/biens?filtre=actifs#haut',
]);

it('rejette une adresse de retour piégée et renvoie vers le hub', function (string $url): void {
    expect(Hub::isAllowedReturnTo($url))->toBeFalse()
        ->and(Hub::safeReturnTo($url))->toBe('https://auth.eguardimmo.test/');
})->with([
    'hôte étranger' => 'https://evil.example/',
    'suffixe trompeur' => 'https://agence.eguardimmo.test.evil.example/',
    'préfixe trompeur' => 'https://evilagence.eguardimmo.test/',
    'relative au protocole' => '//evil.example/',
    'identifiants' => 'https://agence.eguardimmo.test@evil.example/',
    'utilisateur légitime' => 'https://user@agence.eguardimmo.test/',
    'antislash' => 'https:\\\\evil.example',
    'antislash dans le chemin' => 'https://agence.eguardimmo.test\\@evil.example',
    'double encodage' => 'https://agence.eguardimmo.test/%252F%252Fevil.example',
    'http hors local' => 'http://agence.eguardimmo.test/',
    'javascript' => 'javascript:alert(1)',
    'data' => 'data:text/html,x',
    'port non listé' => 'https://agence.eguardimmo.test:8443/',
    'chemin relatif' => '/tableau',
    'espace' => 'https://agence.eguardimmo.test /',
    'tabulation' => "https://agence.eguardimmo.test\t.evil.example/",
    'vide' => '',
]);

it('renvoie vers le hub sans adresse de retour', function (): void {
    expect(Hub::safeReturnTo(null))->toBe('https://auth.eguardimmo.test/');
});
