<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Subscriptions\Support\PlanGrid;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Console\ConsoleContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\SupportAccessContext as S;
use Tests\Feature\Privacy\PrivacyContext as P;
use Tests\Feature\Tenant\TenantContext as T;

const URL_ACCUEIL = '/api/v1/console/overview';

beforeEach(function (): void {
    app(PlanGrid::class)->seed();
    $this->admin = C::operateur(['admin'], 'Alice Admin');
    $this->support = C::operateur(['support'], 'Sam Support');
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->facturation = C::operateur(['billing'], 'Bill Billing');
    $this->ingenierie = C::operateur(['engineering'], 'Eve Engineering');
    $this->donnees = function (int $organisations = 2): void {
        for ($i = 0; $i < $organisations; $i++) {
            $organisation = T::organisation("Agence {$i}");
            S::demande($this, L::titulaire($organisation), $organisation);
        }
        P::deposer($this, User::factory()->create(), 'access')->assertCreated();
        C::reinitialiser($this);
    };
});

it('refuse l\'accueil sans jeton', function (): void {
    C::reinitialiser($this);

    $this->getJson(URL_ACCUEIL)->assertUnauthorized();
});

it('refuse l\'accueil à l\'ingénierie, sans rôle et à un compte d\'agence', function (): void {
    $sansRole = C::operateur([], 'Sans rôle');

    C::lire($this, $this->ingenierie['jeton'], URL_ACCUEIL)->assertForbidden();
    C::lire($this, $sansRole['jeton'], URL_ACCUEIL)->assertForbidden();

    C::reinitialiser($this);
    $this->actingAs(User::factory()->create(), 'sanctum')->getJson(URL_ACCUEIL)->assertForbidden();
});

it('sert tout l\'accueil à l\'administrateur, en comptes seulement', function (): void {
    ($this->donnees)(2);

    $reponse = C::lire($this, $this->admin['jeton'], URL_ACCUEIL)->assertOk();

    expect(array_keys($reponse->json('data')))->toBe(['generated_at', 'organizations', 'user_accounts', 'subscriptions', 'support', 'privacy'])
        ->and($reponse->json('data.organizations'))->toMatchArray(['total' => 2, 'agencies' => 2, 'individuals' => 0, 'suspended' => 0, 'created_30d' => 2])
        ->and($reponse->json('data.user_accounts.suspended'))->toBe(0)
        ->and($reponse->json('data.user_accounts.total'))->toBeGreaterThanOrEqual(7)
        ->and(array_sum($reponse->json('data.subscriptions.by_status')))->toBe(2)
        ->and(array_sum($reponse->json('data.subscriptions.by_plan')))->toBe(2)
        ->and($reponse->json('data.subscriptions.trials_ending_7d'))->toBeInt()
        ->and($reponse->json('data.support'))->toMatchArray(['open_total' => 2, 'awaiting_support' => 2, 'awaiting_requester' => 0, 'unassigned' => 2])
        ->and($reponse->json('data.privacy'))->toMatchArray(['open_total' => 1, 'overdue' => 0, 'due_within_7d' => 0]);
});

it('limite chaque rôle aux sections qu\'il lit déjà', function (string $cle, array $sections): void {
    ($this->donnees)(1);

    $reponse = C::lire($this, $this->{$cle}['jeton'], URL_ACCUEIL)->assertOk();

    expect(array_keys($reponse->json('data')))->toBe(['generated_at', ...$sections]);
})->with([
    'support' => ['support', ['organizations', 'user_accounts', 'support']],
    'conformité' => ['conformite', ['organizations', 'user_accounts', 'privacy']],
    'facturation' => ['facturation', ['organizations', 'subscriptions']],
]);

it('compte suspensions, revues en attente et organisations suspendues', function (): void {
    $suspendu = User::factory()->create();
    DB::table('users')->where('id', $suspendu->id)->update(['suspended_at' => now()->format('Y-m-d H:i:s.u'), 'suspension_reason' => 'security']);
    $supprime = User::factory()->create();
    $supprime->delete();
    $organisation = T::organisation('Agence suspendue');
    DB::table('organizations')->where('id', $organisation->id)->update(['suspended_at' => now()->format('Y-m-d H:i:s.u'), 'suspension_reason' => 'fraud']);
    C::reinitialiser($this);

    $reponse = C::lire($this, $this->admin['jeton'], URL_ACCUEIL)->assertOk();

    expect($reponse->json('data.user_accounts.suspended'))->toBe(1)
        ->and($reponse->json('data.user_accounts.suspension_to_review'))->toBe(1)
        ->and($reponse->json('data.organizations.suspended'))->toBe(1);

    $nombre = User::query()->count();
    expect($reponse->json('data.user_accounts.total'))->toBe($nombre);
});

it('compte les demandes RGPD en retard et à échéance sous 7 jours avec la prolongation', function (): void {
    $ids = [];

    foreach ([-2, 3, 20] as $jours) {
        $ids[$jours] = (string) P::deposer($this, User::factory()->create(), 'access')->assertCreated()->json('data.id');
    }

    foreach ($ids as $jours => $id) {
        DB::table('privacy_requests')->where('id', $id)->update(['due_at' => now()->addDays($jours)->format('Y-m-d H:i:s.u')]);
    }

    DB::table('privacy_requests')->where('id', $ids[-2])->update(['extended_until' => now()->addDays(30)->format('Y-m-d H:i:s.u'), 'extension_reason' => 'complexity']);
    $enRetard = (string) P::deposer($this, User::factory()->create(), 'portability')->assertCreated()->json('data.id');
    DB::table('privacy_requests')->where('id', $enRetard)->update(['due_at' => now()->subDay()->format('Y-m-d H:i:s.u')]);
    C::reinitialiser($this);

    $reponse = C::lire($this, $this->conformite['jeton'], URL_ACCUEIL)->assertOk();

    expect($reponse->json('data.privacy'))->toMatchArray(['open_total' => 4, 'overdue' => 1, 'due_within_7d' => 1]);
});

it('ignore les demandes RGPD closes', function (): void {
    $id = (string) P::deposer($this, User::factory()->create(), 'access')->assertCreated()->json('data.id');
    DB::table('privacy_requests')->where('id', $id)->update(['status' => 'refused', 'refusal_reason' => 'manifestly_unfounded', 'completed_at' => now()->format('Y-m-d H:i:s.u')]);
    C::reinitialiser($this);

    C::lire($this, $this->conformite['jeton'], URL_ACCUEIL)->assertJsonPath('data.privacy.open_total', 0);
});

it('garde un nombre de requêtes constant quand les données grossissent', function (): void {
    $compter = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        C::lire($this, $this->admin['jeton'], URL_ACCUEIL)->assertOk();
        $nombre = count(array_filter(DB::getQueryLog(), fn (array $requete): bool => ! str_starts_with($requete['query'], 'update "personal_access_tokens"')));
        DB::disableQueryLog();

        return $nombre;
    };

    ($this->donnees)(1);
    $petit = $compter();
    ($this->donnees)(4);
    $grand = $compter();

    expect($grand)->toBe($petit);
});

it('ne sert aucune donnée nominative ni identifiant de ligne', function (): void {
    $organisation = T::organisation('Agence Confidentielle');
    $demandeur = L::titulaire($organisation);
    S::demande($this, $demandeur, $organisation);
    P::deposer($this, $demandeur, 'objection')->assertCreated();
    C::reinitialiser($this);

    $corps = C::lire($this, $this->admin['jeton'], URL_ACCUEIL)->assertOk()->getContent();

    expect($corps)->not->toContain($demandeur->name)
        ->and($corps)->not->toContain($demandeur->email)
        ->and($corps)->not->toContain('Confidentielle')
        ->and($corps)->not->toContain($demandeur->id);
});

it('répond sans mise en cache', function (): void {
    expect(C::lire($this, $this->admin['jeton'], URL_ACCUEIL)->headers->get('Cache-Control'))->toContain('no-store');
});

it('limite l\'accueil à 60 lectures par minute', function (): void {
    for ($i = 0; $i < 60; $i++) {
        C::lire($this, $this->admin['jeton'], URL_ACCUEIL)->assertOk();
    }

    C::lire($this, $this->admin['jeton'], URL_ACCUEIL)->assertStatus(429);
});
