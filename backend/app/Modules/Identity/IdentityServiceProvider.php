<?php

declare(strict_types=1);

namespace App\Modules\Identity;

use App\Modules\Identity\Actions\CheckAccountPassword;
use App\Modules\Identity\Console\ExpireOwnerInvitationsCommand;
use App\Modules\Identity\Console\GrantOperatorCommand;
use App\Modules\Identity\Console\PurgeEmailChangesCommand;
use App\Modules\Identity\Console\RevokeDeferredAppleTokensCommand;
use App\Modules\Identity\Console\RevokeOperatorCommand;
use App\Modules\Identity\Console\SetOperatorRolesCommand;
use App\Modules\Identity\Data\ProfileData;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\Fortify\AuthenticateUser;
use App\Modules\Identity\Fortify\PasswordResetLinkRequestedResponse;
use App\Modules\Identity\Fortify\ResetUserPassword;
use App\Modules\Identity\Fortify\UpdateUserPassword;
use App\Modules\Identity\Http\Middleware\EnforceAbsoluteSession;
use App\Modules\Identity\Http\Middleware\EnsureLoginNotLocked;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Http\Middleware\EnsureSpace;
use App\Modules\Identity\Http\Middleware\EnsureWebSession;
use App\Modules\Identity\Http\Middleware\RefuseOperatorToken;
use App\Modules\Identity\Http\Middleware\RequireOperatorProof;
use App\Modules\Identity\Http\Middleware\RequireOperatorRole;
use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\OperatorRoleAssignment;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\SocialIdentity;
use App\Modules\Identity\Models\TenantInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserDevice;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use App\Modules\Identity\Support\AccountApprovalHandlers;
use App\Shared\Approval\ApprovalHandlers;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;
use Laravel\Fortify\Fortify;
use Laravel\Sanctum\Sanctum;
use SocialiteProviders\Apple\AppleExtendSocialite;
use SocialiteProviders\Manager\SocialiteWasCalled;

final class IdentityServiceProvider extends ServiceProvider
{
    private const ROUTES_FORTIFY_LIMITEES = [
        'password.email',
        'password.update',
        'password.confirm.store',
        'verification.send',
        'two-factor.confirm',
        'user-password.update',
    ];

    private const RENVOIS_PAR_ADRESSE_PAR_MINUTE = 1;

    private const RENVOIS_PAR_ADRESSE_PAR_HEURE = 5;

    public function register(): void
    {
        $this->app->singleton(ProfileRegistry::class);
    }

    public function boot(): void
    {
        Relation::enforceMorphMap([
            'user' => User::class,
            'operator' => Operator::class,
            'operator_role' => OperatorRoleAssignment::class,
            'social_identity' => SocialIdentity::class,
            'user_device' => UserDevice::class,
            'tenant_invitation' => TenantInvitation::class,
            'owner_invitation' => OwnerInvitation::class,
        ]);
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        $this->configurerFortify();
        $this->configurerRoutes();
        $this->configurerLimiteRenvoi();
        $this->configurerLimitesConsole();
        $this->enregistrerProfils();
        $this->app->make(AccountApprovalHandlers::class)->register($this->app->make(ApprovalHandlers::class));

        Event::listen(SocialiteWasCalled::class, [AppleExtendSocialite::class, 'handle']);

        if ($this->app->runningInConsole()) {
            $this->commands([GrantOperatorCommand::class, RevokeOperatorCommand::class, SetOperatorRolesCommand::class, RevokeDeferredAppleTokensCommand::class, ExpireOwnerInvitationsCommand::class, PurgeEmailChangesCommand::class]);
        }
    }

    private function configurerFortify(): void
    {
        Fortify::authenticateUsing(fn (Request $request): ?User => $this->app->make(AuthenticateUser::class)($request));
        Fortify::confirmPasswordsUsing(fn (User $user, ?string $motDePasse): bool => $this->app->make(CheckAccountPassword::class)->handle($user, $motDePasse, 'password_confirmation'));
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);

        $this->app->singleton(FailedPasswordResetLinkRequestResponse::class, PasswordResetLinkRequestedResponse::class);
        $this->app->singleton(SuccessfulPasswordResetLinkRequestResponse::class, PasswordResetLinkRequestedResponse::class);
    }

    private function configurerRoutes(): void
    {
        /** @var Router $routeur */
        $routeur = $this->app->make(Router::class);
        $routeur->aliasMiddleware('space', EnsureSpace::class);
        $routeur->aliasMiddleware('no-operator-token', RefuseOperatorToken::class);
        $routeur->aliasMiddleware('operator', RequireOperatorRole::class);
        $routeur->aliasMiddleware('operator-proof', RequireOperatorProof::class);
        $routeur->aliasMiddleware('reauthenticated', EnsureRecentReauthentication::class);
        $routeur->aliasMiddleware('web-session', EnsureWebSession::class);

        $noyau = $this->app->make(HttpKernel::class);
        $noyau->appendMiddlewareToGroup('web', EnforceAbsoluteSession::class);
        $noyau->appendMiddlewareToGroup('api', EnforceAbsoluteSession::class);
        $noyau->addToMiddlewarePriorityBefore(AuthenticatesRequests::class, EnforceAbsoluteSession::class);

        if (! $this->app->routesAreCached()) {
            Route::middleware('web')->prefix('auth')->group(__DIR__.'/Http/web.php');
        }

        $this->app->booted(function () use ($routeur): void {
            foreach ($routeur->getRoutes()->getRoutes() as $route) {
                if (in_array($route->getName(), self::ROUTES_FORTIFY_LIMITEES, true) && ! in_array('throttle:auth', $route->middleware(), true)) {
                    $route->middleware('throttle:auth');
                }

                if ($route->getName() === 'two-factor.login.store') {
                    $route->middleware(EnsureLoginNotLocked::class);
                }
            }
        });
    }

    private function configurerLimiteRenvoi(): void
    {
        // Limite par adresse, quelle que soit l'IP : la clé est hachée, l'adresse n'apparaît ni en cache ni en journal.
        RateLimiter::for('verification-resend', function (Request $request): array {
            $email = Str::lower(trim((string) $request->string('email')));
            $cle = $email === '' ? 'ip:'.$request->ip() : 'email:'.hash('sha256', $email);

            return [
                Limit::perMinute(self::RENVOIS_PAR_ADRESSE_PAR_MINUTE)->by('verification-resend:'.$cle),
                Limit::perHour(self::RENVOIS_PAR_ADRESSE_PAR_HEURE)->by('verification-resend-heure:'.$cle),
            ];
        });
    }

    /**
     * Débits de la console par opérateur (ADR 0037) : jamais par IP, qui est celle du serveur de la console.
     */
    private function configurerLimitesConsole(): void
    {
        $cle = fn (string $nom, Request $requete): string => $nom.':'.(string) ($requete->user()?->getAuthIdentifier() ?? $requete->ip());

        RateLimiter::for('console-read', fn (Request $requete): Limit => Limit::perMinute(60)->by($cle('console-read', $requete)));
        RateLimiter::for('console-account-search', fn (Request $requete): Limit => Limit::perMinute(30)->by($cle('console-account-search', $requete)));
        RateLimiter::for('console-write', fn (Request $requete): Limit => Limit::perHour(20)->by($cle('console-write', $requete)));
        RateLimiter::for('console-approvals', fn (Request $requete): Limit => Limit::perHour(30)->by($cle('console-approvals', $requete)));
        RateLimiter::for('console-health', fn (Request $requete): Limit => Limit::perMinute(6)->by($cle('console-health', $requete)));
    }

    private function enregistrerProfils(): void
    {
        $this->app->make(ProfileRegistry::class)->register(
            fn (string $userId): array => Operator::query()->where('user_id', $userId)->whereNull('revoked_at')->exists()
                ? [new ProfileData(Space::Operator, 'Console')]
                : [],
        );
    }
}
