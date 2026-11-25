<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\ResolveSocialLogin;
use App\Modules\Identity\Data\SocialIntent;
use App\Modules\Identity\Data\SocialProfileData;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TwoFactorResetNotification;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Console\ConsoleContext as C;

beforeEach(function (): void {
    Notification::fake();
    $this->admin = C::operateur(['admin'], 'Alice Admin');
    $this->admin2 = C::operateur(['admin'], 'Alain Admin');
    $this->support = C::operateur(['support'], 'Sam Support');
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->billing = C::operateur(['billing'], 'Bill Billing');
    $this->cible = User::factory()->create(['name' => 'Jeanne Martin', 'email' => 'jeanne@exemple.fr']);
    $this->url = fn (string $suite = '') => '/api/v1/console/accounts/'.$this->cible->id.$suite;
});

it('cherche un compte par adresse exacte ou identifiant, journalise l\'empreinte et jamais l\'adresse', function (): void {
    $reponse = C::lire($this, $this->support['jeton'], '/api/v1/console/accounts?email=Jeanne@Exemple.fr')->assertOk();

    expect($reponse->json('data'))->toHaveCount(1)
        ->and($reponse->json('data.0'))->toBe(['id' => $this->cible->id, 'name' => 'Jeanne Martin', 'email' => 'jeanne@exemple.fr', 'deleted' => false, 'suspended' => false, 'is_operator' => false]);

    C::lire($this, $this->support['jeton'], '/api/v1/console/accounts?id='.$this->cible->id)->assertOk()->assertJsonCount(1, 'data');
    C::lire($this, $this->support['jeton'], '/api/v1/console/accounts?email=jean@exemple.fr')->assertOk()->assertExactJson(['data' => []]);

    $audit = AuditLog::query()->where('action', 'console.account.searched')->orderBy('occurred_at')->get();
    expect($audit)->toHaveCount(3)
        ->and($audit[0]->metadata['email_fingerprint'])->toBe(app(RecordAudit::class)->fingerprint('jeanne@exemple.fr'))
        ->and(json_encode($audit->pluck('metadata')))->not->toContain('exemple.fr');
});

it('refuse une recherche sans critère, avec deux critères ou mal formée', function (): void {
    C::lire($this, $this->support['jeton'], '/api/v1/console/accounts')->assertUnprocessable();
    C::lire($this, $this->support['jeton'], '/api/v1/console/accounts?email=a@b.fr&id='.$this->cible->id)->assertUnprocessable();
    C::lire($this, $this->support['jeton'], '/api/v1/console/accounts?email=pas-une-adresse')->assertUnprocessable();
    C::lire($this, $this->support['jeton'], '/api/v1/console/accounts?id=pas-un-uuid')->assertUnprocessable();
});

it('sert la fiche d\'un compte : sécurité, appareils, jetons, types de profil, sans noms d\'organisation', function (): void {
    activerDeuxFacteurs($this->cible);
    $this->cible->devices()->create(['fingerprint' => 'appareil-1', 'last_seen_at' => now()]);
    $this->cible->createToken('mobile', ['mobile']);

    $reponse = C::lire($this, $this->conformite['jeton'], ($this->url)())->assertOk();

    expect($reponse->json('data'))->toMatchArray([
        'id' => $this->cible->id,
        'name' => 'Jeanne Martin',
        'email' => 'jeanne@exemple.fr',
        'deleted' => false,
        'is_operator' => false,
        'suspension' => null,
        'two_factor' => ['enabled' => true, 'recovery_codes_remaining' => 2],
        'devices_count' => 1,
        'tokens_count' => 1,
        'profile_types' => [],
        'organizations_count' => 0,
    ]);
    expect(array_keys($reponse->json('data')))->toEqualCanonicalizing([
        'id', 'name', 'email', 'created_at', 'email_verified', 'last_login_at', 'deleted', 'deleted_at', 'is_operator', 'suspension',
        'two_factor', 'devices_count', 'tokens_count', 'profile_types', 'organizations_count',
    ]);
    expect(AuditLog::query()->where('action', 'console.account.viewed')->where('subject_id', $this->cible->id)->exists())->toBeTrue();
});

it('lit un compte supprimé sans son adresse et refuse toute action dessus', function (): void {
    $this->cible->delete();

    C::lire($this, $this->support['jeton'], ($this->url)())->assertOk()->assertJsonPath('data.deleted', true)->assertJsonPath('data.email', null);
    C::ecrire($this, $this->support['jeton'], 'POST', ($this->url)('/session-revocation'))->assertNotFound()->assertJsonPath('code', 'account_not_found');
    C::ecrire($this, $this->support['jeton'], 'POST', ($this->url)('/suspension'), ['reason' => 'fraud'])->assertNotFound()->assertJsonPath('code', 'account_not_found');
});

it('répond 404 account_not_found pour un identifiant inconnu', function (): void {
    C::lire($this, $this->support['jeton'], '/api/v1/console/accounts/'.C::UUID_INCONNU)->assertNotFound()->assertJsonPath('code', 'account_not_found');
});

it('garde les comptes opérateur : lisibles, aucune action de console possible', function (): void {
    $cible = $this->admin2['user'];

    C::lire($this, $this->support['jeton'], '/api/v1/console/accounts/'.$cible->id)->assertOk()->assertJsonPath('data.is_operator', true);
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/accounts/'.$cible->id.'/suspension', ['reason' => 'security'])->assertForbidden()->assertJsonPath('code', 'operator_account_protected');
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/accounts/'.$cible->id.'/session-revocation')->assertForbidden()->assertJsonPath('code', 'operator_account_protected');
    expect($cible->fresh()?->isSuspended())->toBeFalse()
        ->and($cible->tokens()->count())->toBe(1);
});

it('révoque jetons et sessions d\'un compte, avec audit', function (): void {
    $this->cible->createToken('mobile', ['mobile']);
    DB::table('sessions')->insert(['id' => 'sess-1', 'user_id' => $this->cible->id, 'payload' => '', 'last_activity' => time()]);

    C::ecrire($this, $this->support['jeton'], 'POST', ($this->url)('/session-revocation'))->assertOk()->assertJsonPath('data.tokens_count', 0);

    expect(DB::table('sessions')->where('user_id', $this->cible->id)->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'console.account.sessions_revoked')->where('subject_id', $this->cible->id)->exists())->toBeTrue();
});

it('suspend un compte : jetons coupés, 409 la seconde fois, revue par un autre opérateur seulement', function (): void {
    $this->cible->createToken('mobile', ['mobile']);

    $reponse = C::ecrire($this, $this->support['jeton'], 'POST', ($this->url)('/suspension'), ['reason' => 'fraud'])->assertOk();
    expect($reponse->json('data.suspension.reason'))->toBe('fraud')
        ->and($reponse->json('data.suspension.reviewed'))->toBeFalse()
        ->and($reponse->json('data.tokens_count'))->toBe(0);

    $suspendu = $this->cible->fresh();
    expect($suspendu?->suspended_by_user_id)->toBe($this->support['user']->id);

    C::ecrire($this, $this->support['jeton'], 'POST', ($this->url)('/suspension'), ['reason' => 'fraud'])->assertConflict()->assertJsonPath('code', 'account_already_suspended');
    C::ecrire($this, $this->admin['jeton'], 'POST', ($this->url)('/suspension'), ['reason' => 'impaye'])->assertUnprocessable();

    C::ecrire($this, $this->conformite['jeton'], 'POST', ($this->url)('/suspension/review'))->assertOk()->assertJsonPath('data.suspension.reviewed', true);
    $relu = $this->cible->fresh()?->suspension_reviewed_at;
    C::ecrire($this, $this->admin['jeton'], 'POST', ($this->url)('/suspension/review'))->assertOk();
    expect($this->cible->fresh()?->suspension_reviewed_at?->equalTo($relu))->toBeTrue()
        ->and($this->cible->fresh()?->suspension_reviewed_by_user_id)->toBe($this->conformite['user']->id);

    $actions = AuditLog::query()->pluck('action')->all();
    expect($actions)->toContain('console.account.suspended')->toContain('console.account.suspension_reviewed');
});

it('refuse que le suspenseur relise sa propre suspension', function (): void {
    C::ecrire($this, $this->admin['jeton'], 'POST', ($this->url)('/suspension'), ['reason' => 'abuse'])->assertOk();

    C::ecrire($this, $this->admin['jeton'], 'POST', ($this->url)('/suspension/review'))->assertForbidden()->assertJsonPath('code', 'suspension_review_forbidden');
    expect($this->cible->fresh()?->suspension_reviewed_at)->toBeNull();
});

it('répond 409 account_not_suspended à la revue d\'un compte actif', function (): void {
    C::ecrire($this, $this->conformite['jeton'], 'POST', ($this->url)('/suspension/review'))->assertConflict()->assertJsonPath('code', 'account_not_suspended');
});

it('refuse un compte suspendu au hub, au mobile et en jeton social', function (): void {
    C::ecrire($this, $this->support['jeton'], 'POST', ($this->url)('/suspension'), ['reason' => 'security'])->assertOk();
    C::reinitialiser($this);

    $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'password'])->assertForbidden()->assertJsonPath('code', 'account_suspended');
    $this->assertGuest('web');
    $this->postJson('/api/v1/auth/token', ['email' => 'jeanne@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone'])->assertForbidden()->assertJsonPath('code', 'account_suspended');
    expect($this->cible->tokens()->count())->toBe(0);

    $this->cible->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-1', 'email' => 'jeanne@exemple.fr', 'email_verified' => true]);
    $profil = new SocialProfileData(SocialProvider::Google, 'g-1', 'jeanne@exemple.fr', true, 'Jeanne Martin');
    $code = null;
    try {
        app(ResolveSocialLogin::class)->handle($profil, SocialIntent::login());
    } catch (ApiProblem $refus) {
        $code = $refus->problemCode;
    }
    expect($code)->toBe('account_suspended');
});

it('refuse un opérateur suspendu à la console', function (): void {
    $this->admin2['user']->forceFill(['suspended_at' => now()])->save();

    C::lire($this, $this->admin2['jeton'], '/api/v1/console/me')->assertForbidden();
});

it('réactive un compte par double validation : demandeur et valideur distincts', function (): void {
    C::ecrire($this, $this->support['jeton'], 'POST', ($this->url)('/suspension'), ['reason' => 'abuse'])->assertOk();

    $id = C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'identity.account.reactivate', 'subject_id' => $this->cible->id, 'reason' => 'Vérification faite avec le titulaire',
    ])->assertCreated()->json('data.id');

    C::ecrire($this, $this->support['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve")->assertForbidden();
    expect($this->cible->fresh()?->isSuspended())->toBeTrue();

    C::ecrire($this, $this->conformite['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve")->assertOk()->assertJsonPath('data.status', 'approved');

    $compte = $this->cible->fresh();
    expect($compte?->isSuspended())->toBeFalse()
        ->and($compte?->suspension_reason)->toBeNull()
        ->and(AuditLog::query()->where('action', 'identity.account.reactivated')->where('subject_id', $this->cible->id)->exists())->toBeTrue();
});

it('refuse de demander la réactivation d\'un compte actif, d\'un opérateur ou d\'un inconnu', function (): void {
    $corps = fn (string $id): array => ['action' => 'identity.account.reactivate', 'subject_id' => $id, 'reason' => 'Vérification faite avec le titulaire'];

    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps($this->cible->id))->assertConflict()->assertJsonPath('code', 'account_not_suspended');
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps($this->admin2['user']->id))->assertForbidden()->assertJsonPath('code', 'operator_account_protected');
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps(C::UUID_INCONNU))->assertNotFound()->assertJsonPath('code', 'account_not_found');
});

it('passe la demande en échec si le compte a été réactivé entre-temps', function (): void {
    C::ecrire($this, $this->support['jeton'], 'POST', ($this->url)('/suspension'), ['reason' => 'abuse'])->assertOk();
    $id = C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'identity.account.reactivate', 'subject_id' => $this->cible->id, 'reason' => 'Vérification faite avec le titulaire',
    ])->assertCreated()->json('data.id');
    User::query()->whereKey($this->cible->id)->update(['suspended_at' => null, 'suspension_reason' => null]);

    C::ecrire($this, $this->conformite['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve")->assertConflict()->assertJsonPath('code', 'approval_stale');
});

it('réinitialise la double authentification par double validation, révoque tout et prévient le titulaire', function (): void {
    activerDeuxFacteurs($this->cible);
    $this->cible->createToken('mobile', ['mobile']);
    DB::table('sessions')->insert(['id' => 'sess-2', 'user_id' => $this->cible->id, 'payload' => '', 'last_activity' => time()]);

    $id = C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'identity.account.reset_two_factor', 'subject_id' => $this->cible->id, 'reason' => 'Téléphone perdu, identité vérifiée',
        'payload' => ['verification_method' => 'video_call'],
    ])->assertCreated()->assertJsonPath('data.payload', ['verification_method' => 'video_call'])->json('data.id');

    expect($this->cible->fresh()?->hasConfirmedTwoFactor())->toBeTrue();
    C::ecrire($this, $this->admin['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve")->assertOk();

    $compte = $this->cible->fresh();
    expect($compte?->two_factor_secret)->toBeNull()
        ->and($compte?->two_factor_recovery_codes)->toBeNull()
        ->and($compte?->two_factor_confirmed_at)->toBeNull()
        ->and($compte?->tokens()->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $this->cible->id)->count())->toBe(0);
    Notification::assertSentTo($this->cible, TwoFactorResetNotification::class);

    $audit = AuditLog::query()->where('action', 'identity.account.two_factor_reset')->firstOrFail();
    expect($audit->metadata['verification_method'])->toBe('video_call');
});

it('ne réinitialise pas la double authentification d\'un compte devenu opérateur après la demande', function (): void {
    activerDeuxFacteurs($this->cible);
    $id = C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'identity.account.reset_two_factor', 'subject_id' => $this->cible->id, 'reason' => 'Téléphone perdu, identité vérifiée',
        'payload' => ['verification_method' => 'video_call'],
    ])->assertCreated()->json('data.id');
    $this->cible->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'support', 'granted_at' => now()]);

    C::ecrire($this, $this->admin['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve")->assertConflict()->assertJsonPath('code', 'approval_stale');

    expect($this->cible->fresh()?->hasConfirmedTwoFactor())->toBeTrue();
    Notification::assertNothingSentTo($this->cible);
});

it('refuse de demander la réinitialisation 2FA d\'un compte opérateur', function (): void {
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'identity.account.reset_two_factor', 'subject_id' => $this->admin2['user']->id, 'reason' => 'Téléphone perdu, identité vérifiée',
        'payload' => ['verification_method' => 'video_call'],
    ])->assertForbidden()->assertJsonPath('code', 'operator_account_protected');

    expect($this->admin2['user']->fresh()?->hasConfirmedTwoFactor())->toBeTrue();
});

it('refuse la réinitialisation 2FA sans méthode de vérification valide ou sans 2FA active', function (): void {
    $corps = fn (array $charge): array => ['action' => 'identity.account.reset_two_factor', 'subject_id' => $this->cible->id, 'reason' => 'Téléphone perdu, identité vérifiée', 'payload' => $charge];

    activerDeuxFacteurs($this->cible);
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps([]))->assertUnprocessable();
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps(['verification_method' => 'a_la_confiance']))->assertUnprocessable();

    User::query()->whereKey($this->cible->id)->update(['two_factor_secret' => null, 'two_factor_confirmed_at' => null]);
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps(['verification_method' => 'known_channel']))->assertConflict()->assertJsonPath('code', 'two_factor_not_enabled');
});

it('garde les routes comptes : 401 sans jeton, 403 par rôle, 403 avec un jeton hors espace opérateur', function (): void {
    $routes = [
        ['GET', '/api/v1/console/accounts?id='.C::UUID_INCONNU, ['admin', 'support', 'compliance']],
        ['GET', '/api/v1/console/accounts/'.C::UUID_INCONNU, ['admin', 'support', 'compliance']],
        ['POST', '/api/v1/console/accounts/'.C::UUID_INCONNU.'/session-revocation', ['admin', 'support']],
        ['POST', '/api/v1/console/accounts/'.C::UUID_INCONNU.'/suspension', ['admin', 'support']],
        ['POST', '/api/v1/console/accounts/'.C::UUID_INCONNU.'/suspension/review', ['admin', 'compliance']],
    ];
    $operateurs = ['admin' => $this->admin, 'support' => $this->support, 'compliance' => $this->conformite, 'billing' => $this->billing];
    $mobile = $this->cible->createToken('mobile', ['mobile'])->plainTextToken;

    foreach ($routes as [$methode, $url, $autorises]) {
        C::reinitialiser($this);
        $this->json($methode, $url)->assertUnauthorized();

        C::reinitialiser($this);
        $this->withToken($mobile)->json($methode, $url)->assertForbidden();

        foreach ($operateurs as $role => $op) {
            if (in_array($role, $autorises, true)) {
                continue;
            }
            C::ecrire($this, $op['jeton'], $methode, $url, ['reason' => 'fraud'])->assertForbidden()->assertJsonPath('code', 'operator_role_required');
        }
    }
});

it('exige la preuve 2FA sur chaque écriture de compte', function (): void {
    foreach (['/session-revocation', '/suspension', '/suspension/review'] as $suite) {
        C::ecrireBrut($this, $this->admin['jeton'], 'POST', ($this->url)($suite), ['reason' => 'fraud'])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_required');
    }
    expect($this->cible->fresh()?->isSuspended())->toBeFalse();
});

it('garde un nombre de requêtes constant pour la fiche, quel que soit le volume d\'appareils et de jetons', function (): void {
    $compter = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        C::lire($this, $this->admin['jeton'], ($this->url)())->assertOk();
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $n;
    };
    $compter();
    $avant = $compter();

    foreach (range(1, 6) as $i) {
        $this->cible->devices()->create(['fingerprint' => "appareil-{$i}", 'last_seen_at' => now()]);
        $this->cible->createToken("jeton-{$i}", ['mobile']);
    }

    expect($compter())->toBe($avant);
});
