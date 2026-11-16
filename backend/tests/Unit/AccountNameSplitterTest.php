<?php

declare(strict_types=1);

use App\Modules\Organizations\Support\AccountNameSplitter;

it('découpe le nom du compte de façon déterministe', function (string $compte, string $prenom, string $nom): void {
    expect(AccountNameSplitter::split($compte))->toBe([$prenom, $nom]);
})->with([
    'deux mots' => ['Jeanne Martin', 'Jeanne', 'Martin'],
    'le reste devient le nom' => ['Jean Pierre de La Fontaine', 'Jean', 'Pierre de La Fontaine'],
    'espaces superflus' => ["  Awa \t  Diallo  ", 'Awa', 'Diallo'],
    'un seul mot sert de prénom et de nom' => ['Madonna', 'Madonna', 'Madonna'],
    'accents conservés' => ['Éloïse Çelik', 'Éloïse', 'Çelik'],
]);

it('tronque prénom et nom à 60 caractères', function (): void {
    [$prenom, $nom] = AccountNameSplitter::split(str_repeat('a', 80).' '.str_repeat('é', 80));

    expect(mb_strlen($prenom))->toBe(60)
        ->and(mb_strlen($nom))->toBe(60);
});
