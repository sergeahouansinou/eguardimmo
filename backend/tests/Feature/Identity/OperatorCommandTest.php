<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\GrantOperator;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\OperatorRoleAssignment;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OperatorGrantedNotification;
use App\Modules\Identity\Notifications\OperatorRolesChangedNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Notification;

const QUESTION_CODE_ATTRIBUTION = 'Code à 6 chiffres affiché par l\'application du titulaire';

beforeEach(function (): void {
    Notification::fake();
    $this->autreAdmin = function (): User {
        $autre = User::factory()->create();
        $autre->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);

        return $autre;
    };
});

it('attribue le rôle opérateur à un compte existant, audite et prévient les opérateurs', function (): void {
    $existant = User::factory()->create();
    $existant->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    $user = User::factory()->create(['email' => 'nouveau@exemple.fr']);
    $secret = imposerSecretTotp();

    $this->artisan('identity:grant-operator', ['email' => 'Nouveau@Exemple.fr', '--role' => ['support', 'compliance']])
        ->expectsConfirmation('Attribuer le rôle opérateur (support, compliance) à nouveau@exemple.fr ?', 'yes')
        ->expectsQuestion(QUESTION_CODE_ATTRIBUTION, codeTotp($secret))
        ->assertSuccessful();

    expect($user->refresh()->isActiveOperator())->toBeTrue()
        ->and(array_map(fn ($r) => $r->value, $user->operatorRoles()))->toEqualCanonicalizing(['support', 'compliance'])
        ->and(AuditLog::query()->where('action', 'identity.operator.roles_changed')->where('subject_id', $user->id)->first()?->metadata)->toMatchArray(['roles' => ['compliance', 'support']])
        ->and(AuditLog::query()->where('action', 'identity.operator.granted')->where('subject_id', $user->id)->first()?->metadata)->toMatchArray(['via' => 'artisan', 'host' => (string) gethostname()]);
    Notification::assertSentTo([$existant, $user], OperatorGrantedNotification::class);
});

it('échoue pour un e-mail inconnu', function (): void {
    $this->artisan('identity:grant-operator', ['email' => 'inconnu@exemple.fr', '--role' => ['admin']])->assertFailed();

    expect(AuditLog::query()->count())->toBe(0);
});

it('n\'attribue rien sans confirmation', function (): void {
    $user = User::factory()->create(['email' => 'nouveau@exemple.fr']);

    $this->artisan('identity:grant-operator', ['email' => 'nouveau@exemple.fr', '--role' => ['admin']])
        ->expectsConfirmation('Attribuer le rôle opérateur (admin) à nouveau@exemple.fr ?', 'no')
        ->assertFailed();

    expect($user->refresh()->isActiveOperator())->toBeFalse();
});

it('retire le rôle opérateur et révoque les jetons console', function (): void {
    ($this->autreAdmin)();
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
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

it('refuse d\'attribuer le rôle opérateur sans rôle ou avec un rôle inconnu', function (): void {
    $user = User::factory()->create(['email' => 'nouveau@exemple.fr']);

    $this->artisan('identity:grant-operator', ['email' => 'nouveau@exemple.fr'])->assertFailed();
    $this->artisan('identity:grant-operator', ['email' => 'nouveau@exemple.fr', '--role' => ['superadmin']])->assertFailed();

    expect($user->refresh()->isActiveOperator())->toBeFalse();
});

it('remplace les rôles d\'un opérateur, audite le changement et prévient les opérateurs', function (): void {
    ($this->autreAdmin)();
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($user);

    $this->artisan('identity:set-operator-roles', ['email' => 'ops@exemple.fr', '--role' => ['billing']])
        ->expectsConfirmation('Fixer les rôles de ops@exemple.fr à : billing ?', 'yes')
        ->assertSuccessful();

    expect(array_map(fn ($r) => $r->value, $user->refresh()->operatorRoles()))->toBe(['billing'])
        ->and(AuditLog::query()->where('action', 'identity.operator.roles_changed')->first()?->metadata)->toMatchArray(['previous' => ['admin'], 'roles' => ['billing'], 'via' => 'artisan']);
    Notification::assertSentTo($user, OperatorRolesChangedNotification::class);
});

it('refuse de fixer les rôles d\'un compte qui n\'est pas opérateur', function (): void {
    User::factory()->create(['email' => 'simple@exemple.fr']);

    $this->artisan('identity:set-operator-roles', ['email' => 'simple@exemple.fr', '--role' => ['admin']])
        ->expectsConfirmation('Fixer les rôles de simple@exemple.fr à : admin ?', 'yes')
        ->assertFailed();
});

it('retire les rôles avec le rôle opérateur', function (): void {
    ($this->autreAdmin)();
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $operateur = $user->operator()->create(['granted_at' => now()]);
    $operateur->roles()->create(['role' => 'admin', 'granted_at' => now()]);

    $this->artisan('identity:revoke-operator', ['email' => 'ops@exemple.fr'])
        ->expectsConfirmation('Retirer le rôle opérateur à ops@exemple.fr ?', 'yes')
        ->assertSuccessful();

    expect($operateur->roles()->count())->toBe(0);
});

it('refuse de révoquer le dernier administrateur sans --force, puis l\'accepte avec', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    $user->createToken('console', ['operator']);

    $this->artisan('identity:revoke-operator', ['email' => 'ops@exemple.fr'])
        ->expectsConfirmation('Retirer le rôle opérateur à ops@exemple.fr ?', 'yes')
        ->expectsOutputToContain('dernier opérateur administrateur')
        ->assertFailed();

    expect($user->refresh()->isActiveOperator())->toBeTrue()
        ->and($user->tokens()->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'identity.operator.revoked')->count())->toBe(0);

    $this->artisan('identity:revoke-operator', ['email' => 'ops@exemple.fr', '--force' => true])
        ->expectsConfirmation('Retirer le rôle opérateur à ops@exemple.fr ?', 'yes')
        ->assertSuccessful();

    expect($user->refresh()->isActiveOperator())->toBeFalse();
});

it('refuse de retirer le rôle administrateur du dernier administrateur sans --force, mais autorise un changement qui le conserve', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($user);

    $this->artisan('identity:set-operator-roles', ['email' => 'ops@exemple.fr', '--role' => ['billing']])
        ->expectsConfirmation('Fixer les rôles de ops@exemple.fr à : billing ?', 'yes')
        ->expectsOutputToContain('dernier opérateur administrateur')
        ->assertFailed();

    expect(array_map(fn ($r) => $r->value, $user->refresh()->operatorRoles()))->toBe(['admin']);

    $this->artisan('identity:set-operator-roles', ['email' => 'ops@exemple.fr', '--role' => ['admin', 'billing']])
        ->expectsConfirmation('Fixer les rôles de ops@exemple.fr à : admin, billing ?', 'yes')
        ->assertSuccessful();

    $this->artisan('identity:set-operator-roles', ['email' => 'ops@exemple.fr', '--role' => ['billing'], '--force' => true])
        ->expectsConfirmation('Fixer les rôles de ops@exemple.fr à : billing ?', 'yes')
        ->assertSuccessful();

    expect(array_map(fn ($r) => $r->value, $user->refresh()->operatorRoles()))->toBe(['billing']);
});

it('retire sans --force un opérateur non administrateur, même quand il n\'y a qu\'un administrateur', function (): void {
    $admin = User::factory()->create();
    $admin->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    $simple = User::factory()->create(['email' => 'simple@exemple.fr']);
    $simple->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'support', 'granted_at' => now()]);

    $this->artisan('identity:revoke-operator', ['email' => 'simple@exemple.fr'])
        ->expectsConfirmation('Retirer le rôle opérateur à simple@exemple.fr ?', 'yes')
        ->assertSuccessful();

    expect($admin->refresh()->isActiveOperator())->toBeTrue();
});

it('n\'attribue ni rôle ni second facteur quand le code saisi est faux', function (): void {
    $user = User::factory()->create(['email' => 'nouveau@exemple.fr']);
    $user->createToken('mobile', ['mobile']);
    imposerSecretTotp();

    $this->artisan('identity:grant-operator', ['email' => 'nouveau@exemple.fr', '--role' => ['admin']])
        ->expectsConfirmation('Attribuer le rôle opérateur (admin) à nouveau@exemple.fr ?', 'yes')
        ->expectsQuestion(QUESTION_CODE_ATTRIBUTION, '000000x')
        ->assertFailed();

    expect($user->refresh()->operator()->count())->toBe(0)
        ->and($user->two_factor_secret)->toBeNull()
        ->and($user->tokens()->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'identity.operator.granted')->count())->toBe(0);
    Notification::assertNothingSent();
});

it('réactive un opérateur révoqué avec un nouveau second facteur et ferme ses sessions', function (): void {
    $user = User::factory()->create(['email' => 'ancien@exemple.fr']);
    $user->operator()->create(['granted_at' => now(), 'revoked_at' => now()]);
    activerDeuxFacteurs($user);
    $ancien = $user->two_factor_secret;
    $user->createToken('mobile', ['mobile']);
    $secret = imposerSecretTotp();

    $this->artisan('identity:grant-operator', ['email' => 'ancien@exemple.fr', '--role' => ['admin']])
        ->expectsConfirmation('Attribuer le rôle opérateur (admin) à ancien@exemple.fr ?', 'yes')
        ->expectsQuestion(QUESTION_CODE_ATTRIBUTION, codeTotp($secret))
        ->assertSuccessful();

    expect($user->refresh()->isActiveOperator())->toBeTrue()
        ->and($user->two_factor_secret)->not->toBe($ancien)
        ->and($user->recoveryCodes())->toHaveCount(8)
        ->and($user->tokens()->count())->toBe(0);
});

it('défait l\'enrôlement quand l\'attribution échoue après lui', function (): void {
    $user = User::factory()->create(['email' => 'nouveau@exemple.fr']);
    $secret = imposerSecretTotp();
    OperatorRoleAssignment::creating(fn () => throw new RuntimeException('panne'));

    expect(fn () => app(GrantOperator::class)->handle($user, [OperatorRole::Admin], $secret, codeTotp($secret)))
        ->toThrow(RuntimeException::class);

    expect($user->refresh()->two_factor_secret)->toBeNull()
        ->and($user->operator()->count())->toBe(0);
    Notification::assertNothingSent();
});

it('n\'ajoute aucun rôle à un opérateur sans double authentification, mais permet d\'en retirer', function (): void {
    ($this->autreAdmin)();
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $operateur = $user->operator()->create(['granted_at' => now()]);
    $operateur->roles()->create(['role' => 'support', 'granted_at' => now()]);
    $operateur->roles()->create(['role' => 'billing', 'granted_at' => now()]);

    $this->artisan('identity:set-operator-roles', ['email' => 'ops@exemple.fr', '--role' => ['support', 'admin']])
        ->expectsConfirmation('Fixer les rôles de ops@exemple.fr à : support, admin ?', 'yes')
        ->expectsOutputToContain('identity:enroll-operator-two-factor')
        ->assertFailed();

    expect(array_map(fn ($r) => $r->value, $user->fresh()?->operatorRoles() ?? []))->toEqualCanonicalizing(['support', 'billing']);

    $this->artisan('identity:set-operator-roles', ['email' => 'ops@exemple.fr', '--role' => ['support']])
        ->expectsConfirmation('Fixer les rôles de ops@exemple.fr à : support ?', 'yes')
        ->assertSuccessful();

    expect(array_map(fn ($r) => $r->value, $user->fresh()?->operatorRoles() ?? []))->toBe(['support']);
});
