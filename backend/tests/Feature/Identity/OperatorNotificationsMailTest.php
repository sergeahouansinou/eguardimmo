<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OperatorGrantedNotification;
use App\Modules\Identity\Notifications\OperatorRolesChangedNotification;

const ADRESSE_HOSTILE = 'x](https://evil.example/login)[ops@exemple.fr';

it('échappe l\'adresse du bénéficiaire : aucun lien ni balise ne sort du texte brut', function (string $classe): void {
    $message = (new $classe(ADRESSE_HOSTILE))->toMail(User::factory()->create());
    $html = (string) $message->render();

    expect(implode(' ', $message->introLines))->toContain('x\]\(https://evil.example/login\)\[ops@exemple.fr')
        ->and($html)->not->toContain('href="https://evil.example');
})->with([
    'attribution' => [OperatorGrantedNotification::class],
    'changement de rôles' => [OperatorRolesChangedNotification::class],
]);

it('garde une adresse ordinaire lisible dans le message', function (string $classe): void {
    $message = (new $classe('ops@exemple.fr'))->toMail(User::factory()->create());

    expect(implode(' ', $message->introLines))->toContain('ops@exemple.fr');
})->with([
    'attribution' => [OperatorGrantedNotification::class],
    'changement de rôles' => [OperatorRolesChangedNotification::class],
]);
