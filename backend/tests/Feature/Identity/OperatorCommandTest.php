<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OperatorGrantedNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    Notification::fake();
});

it('attribue le rôle opérateur à un compte existant, audite et prévient les opérateurs', function (): void {
    $existant = User::factory()->create();
    $existant->operator()->create(['granted_at' => now()]);
    $user = User::factory()->create(['email' => 'nouveau@exemple.fr']);

    $this->artisan('identity:grant-operator', ['email' => 'Nouveau@Exemple.fr'])
        ->expectsConfirmation('Attribuer le rôle opérateur à nouveau@exemple.fr ?', 'yes')
        ->assertSuccessful();

    expect($user->refresh()->isActiveOperator())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'identity.operator.granted')->where('subject_id', $user->id)->first()?->metadata)->toMatchArray(['via' => 'artisan', 'host' => (string) gethostname()]);
    Notification::assertSentTo([$existant, $user], OperatorGrantedNotification::class);
});

it('échoue pour un e-mail inconnu', function (): void {
    $this->artisan('identity:grant-operator', ['email' => 'inconnu@exemple.fr'])->assertFailed();

    expect(AuditLog::query()->count())->toBe(0);
});

it('n\'attribue rien sans confirmation', function (): void {
    $user = User::factory()->create(['email' => 'nouveau@exemple.fr']);

    $this->artisan('identity:grant-operator', ['email' => 'nouveau@exemple.fr'])
        ->expectsConfirmation('Attribuer le rôle opérateur à nouveau@exemple.fr ?', 'no')
        ->assertFailed();

    expect($user->refresh()->isActiveOperator())->toBeFalse();
});

it('retire le rôle opérateur et révoque les jetons console', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()]);
    $user->createToken('console', ['operator']);
    $user->createToken('mobile', ['mobile']);

    $this->artisan('identity:revoke-operator', ['email' => 'ops@exemple.fr'])
        ->expectsConfirmation('Retirer le rôle opérateur à ops@exemple.fr ?', 'yes')
        ->assertSuccessful();

    expect($user->refresh()->isActiveOperator())->toBeFalse()
        ->and($user->tokens()->pluck('name')->all())->toBe(['mobile'])
        ->and(AuditLog::query()->where('action', 'identity.operator.revoked')->count())->toBe(1);
});

it('échoue au retrait pour un compte non opérateur', function (): void {
    User::factory()->create(['email' => 'simple@exemple.fr']);

    $this->artisan('identity:revoke-operator', ['email' => 'simple@exemple.fr'])
        ->expectsConfirmation('Retirer le rôle opérateur à simple@exemple.fr ?', 'yes')
        ->assertFailed();
});
