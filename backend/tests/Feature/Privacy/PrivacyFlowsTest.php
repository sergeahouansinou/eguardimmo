<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Models\PrivacyRequestEvent;
use App\Modules\Privacy\Models\PrivacyRequestForward;
use App\Modules\Privacy\Notifications\PrivacyDeadlineNotification;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Feature\Console\ConsoleContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Privacy\PrivacyContext as P;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Mail::fake();
    Storage::fake('local');
    config(['notifications.push.driver' => 'fake', 'privacy.team_address' => 'conformite@example.test']);
    $this->admin = C::operateur(['admin'], 'Alice Admin');
    $this->support = C::operateur(['support'], 'Sam Support');
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->conformite2 = C::operateur(['compliance'], 'Corinne Conformité');
    $this->demandeur = User::factory()->create(['name' => 'Léa Martin', 'email' => 'lea.martin@example.test']);
    $this->autre = User::factory()->create(['name' => 'Paul Autre', 'email' => 'paul.autre@example.test']);
    $this->org = T::organisation('Agence du Port');
    $this->titulaire = L::titulaire($this->org);
    $this->autreOrg = T::organisation('Agence du Nord');
    $this->lier = fn (Organization $o, User $u) => L::dans($o, fn () => OrganizationMember::query()->create([
        'user_id' => $u->id, 'email' => mb_strtolower($u->email), 'first_name' => 'Léa', 'last_name' => 'Martin',
        'role' => MemberRole::Manager, 'status' => MemberStatus::Active, 'joined_at' => now(),
    ]));
    $this->horsApp = fn (string $adresse, string $type = 'access') => C::ecrire($this, $this->conformite['jeton'], 'POST', P::CONSOLE, [
        'kind' => $type, 'channel' => 'letter', 'requester_email' => $adresse,
    ])->assertCreated()->json('data.id');
    $this->verifier = fn (string $id) => P::agir($this, $this->conformite, $id, 'verify', ['verification_method' => 'document_seen'])->assertOk();
});

it('transmet la demande aux organisations liées au compte, une seule fois chacune, et les prévient', function (): void {
    ($this->lier)($this->org, $this->demandeur);
    $id = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');

    $reponse = P::agir($this, $this->conformite, $id, 'forward')->assertOk();

    expect($reponse->json('meta.forwarded'))->toBe(1)
        ->and($reponse->json('data.forwards'))->toBe(['total' => 1, 'handled' => 0])
        ->and($reponse->json('data.status'))->toBe('in_progress')
        ->and(N::nombre($this->titulaire, NotificationType::PrivacyRequestForwarded))->toBe(1)
        ->and(N::nombre($this->demandeur, NotificationType::PrivacyRequestForwarded))->toBe(0)
        ->and(N::nombre(L::titulaire($this->autreOrg), NotificationType::PrivacyRequestForwarded))->toBe(0);

    P::agir($this, $this->conformite, $id, 'forward')->assertOk()->assertJsonPath('meta.forwarded', 0)->assertJsonPath('data.forwards.total', 1);

    ($this->lier)($this->autreOrg, $this->demandeur);
    P::agir($this, $this->conformite, $id, 'forward')->assertOk()->assertJsonPath('meta.forwarded', 1)->assertJsonPath('data.forwards.total', 2);
    expect(AcrossOrganizations::query(PrivacyRequestForward::class)->count())->toBe(2)
        ->and(AuditLog::query()->where('action', 'privacy.request.forwarded')->count())->toBe(3)
        ->and(DB::table('privacy_request_forwards')->value('requester_email'))->not->toContain('example.test');
});

it('refuse de transmettre une demande sans identité vérifiée ou sans compte', function (): void {
    $id = ($this->horsApp)('lea.martin@example.test');
    P::agir($this, $this->conformite, $id, 'forward')->assertConflict()->assertJsonPath('code', 'privacy_identity_not_verified');

    $sansCompte = ($this->horsApp)('personne@example.test');
    ($this->verifier)($sansCompte);
    P::agir($this, $this->conformite, $sansCompte, 'forward')->assertConflict()->assertJsonPath('code', 'privacy_account_required');
    P::agir($this, $this->conformite, $sansCompte, 'complete')->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.export.generated', false);
});

it('montre à l\'owner et à l\'admin le demandeur transmis, jamais à un autre rôle, une autre organisation ou un non-membre', function (): void {
    ($this->lier)($this->org, $this->demandeur);
    $id = P::deposer($this, $this->demandeur, 'rectification')->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $id, 'forward')->assertOk();
    $gestionnaire = L::membre($this->org, MemberRole::Manager);
    $url = "/api/v1/org/{$this->org->id}/privacy-requests";

    $liste = T::comme($this, $this->titulaire)->getJson($url)->assertOk();
    $ligne = $liste->json('data.0');

    expect($liste->json('data'))->toHaveCount(1)
        ->and($ligne)->toMatchArray(['kind' => 'rectification', 'requester' => ['name' => 'Léa Martin', 'email' => 'lea.martin@example.test'], 'handled' => false, 'handled_at' => null])
        ->and(array_keys($ligne))->toEqualCanonicalizing(['id', 'kind', 'requester', 'deadline', 'forwarded_at', 'handled', 'handled_at'])
        ->and($ligne['id'])->not->toBe($id)
        ->and($liste->json('meta'))->toBe(['has_more' => false, 'next_cursor' => null]);

    T::comme($this, $gestionnaire)->getJson($url)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    T::comme($this, L::titulaire($this->autreOrg))->getJson($url)->assertNotFound();
    T::comme($this, $this->autre)->getJson($url)->assertNotFound();
    T::comme($this, L::titulaire($this->autreOrg))->getJson("/api/v1/org/{$this->autreOrg->id}/privacy-requests")->assertOk()->assertJsonCount(0, 'data');
    C::reinitialiser($this);
    $this->getJson($url)->assertUnauthorized();
    $this->postJson("{$url}/{$ligne['id']}/handled")->assertUnauthorized();
    $this->withToken($this->conformite['jeton'])->getJson($url)->assertNotFound();
});

it('marque une demande traitée par l\'organisation : une seule fois, jamais celle d\'une autre organisation, même suspendue', function (): void {
    ($this->lier)($this->org, $this->demandeur);
    $id = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $id, 'forward')->assertOk();
    $transmission = T::comme($this, $this->titulaire)->getJson("/api/v1/org/{$this->org->id}/privacy-requests")->json('data.0.id');
    $gestionnaire = L::membre($this->org, MemberRole::Manager);

    T::comme($this, $gestionnaire)->postJson("/api/v1/org/{$this->org->id}/privacy-requests/{$transmission}/handled")->assertForbidden();
    T::comme($this, L::titulaire($this->autreOrg))->postJson("/api/v1/org/{$this->autreOrg->id}/privacy-requests/{$transmission}/handled")->assertNotFound()->assertJsonPath('code', 'privacy_request_not_found');
    T::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/privacy-requests/".C::UUID_INCONNU.'/handled')->assertNotFound();

    Organization::query()->whereKey($this->org->id)->update(['suspended_at' => now(), 'suspension_reason' => 'fraud']);
    $reponse = T::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/privacy-requests/{$transmission}/handled")->assertOk();
    $traitee = $reponse->json('data.handled_at');

    expect($reponse->json('data.handled'))->toBeTrue();
    $this->travelTo(now()->addHour());
    T::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/privacy-requests/{$transmission}/handled")->assertOk()->assertJsonPath('data.handled_at', $traitee);

    expect(AuditLog::query()->where('action', 'privacy.request.handled')->count())->toBe(1)
        ->and(PrivacyRequestEvent::query()->where('kind', 'forward_handled')->count())->toBe(1);
    C::lire($this, $this->admin['jeton'], P::CONSOLE."/{$id}")->assertOk()->assertJsonPath('data.forwards', ['total' => 1, 'handled' => 1]);
});

it('produit l\'export d\'un compte, téléchargeable par le seul demandeur : ses données, sans notes internes ni secrets ni données d\'autrui', function (): void {
    ($this->lier)($this->org, $this->demandeur);
    $ticket = (string) T::comme($this, $this->demandeur)->postJson('/api/v1/support/tickets', ['space' => 'marketplace', 'category' => 'account', 'subject' => 'Facture manquante', 'body' => 'Ma quittance est absente.'])->assertCreated()->json('data.id');
    C::ecrire($this, $this->admin['jeton'], 'POST', "/api/v1/console/support/tickets/{$ticket}/messages", ['body' => 'Note interne confidentielle', 'internal' => true])->assertSuccessful();
    C::ecrire($this, $this->admin['jeton'], 'POST', "/api/v1/console/support/tickets/{$ticket}/messages", ['body' => 'Nous regardons cela.'])->assertSuccessful();
    N::ligne($this->demandeur, null, NotificationType::AccountSupportReplied, ['body' => 'Réponse pour Léa']);
    N::ligne($this->autre, null, NotificationType::AccountSupportReplied, ['body' => 'Réponse pour Paul']);
    $id = P::deposer($this, $this->demandeur, 'portability')->assertCreated()->json('data.id');

    $cloture = P::agir($this, $this->conformite, $id, 'complete')->assertOk();

    expect($cloture->json('data'))->toMatchArray(['status' => 'completed'])
        ->and($cloture->json('data.export'))->toMatchArray(['generated' => true, 'downloaded' => false])
        ->and(N::nombre($this->demandeur, NotificationType::AccountExportReady))->toBe(1)
        ->and(N::nombre($this->demandeur, NotificationType::AccountPrivacyCompleted))->toBe(0);

    $chemin = (string) PrivacyRequest::query()->findOrFail($id)->export_path;
    expect(Storage::disk('local')->get($chemin))->not->toContain('lea.martin@example.test')->not->toContain('Léa');

    $fichier = P::avecPreuve(T::comme($this, $this->demandeur))->get(P::URL."/{$id}/export")->assertOk();
    $texte = $fichier->getContent();
    $donnees = json_decode($texte, true, flags: JSON_THROW_ON_ERROR);

    expect($fichier->headers->get('Content-Type'))->toBe('application/json')
        ->and($fichier->headers->get('Content-Disposition'))->toContain('attachment')
        ->and($fichier->headers->get('Cache-Control'))->toContain('no-store')
        ->and($donnees['account']['email'])->toBe('lea.martin@example.test')
        ->and($donnees['request']['kind'])->toBe('portability')
        ->and($donnees['support_tickets']['tickets'])->toHaveCount(1)
        ->and(array_column($donnees['support_tickets']['tickets'][0]['messages'], 'body'))->toBe(['Ma quittance est absente.', 'Nous regardons cela.'])
        ->and(array_column($donnees['notifications']['notifications'], 'body'))->toContain('Réponse pour Léa')->not->toContain('Réponse pour Paul')
        ->and($texte)->not->toContain('Note interne confidentielle')->not->toContain('paul.autre@example.test')->not->toContain('password')->not->toContain('two_factor_secret')->not->toContain('recovery')
        ->and(array_key_exists('organization_data', $donnees))->toBeTrue();

    expect(AuditLog::query()->where('action', 'privacy.export.downloaded')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'privacy.request.exported')->count())->toBe(1)
        ->and(PrivacyRequestEvent::query()->where('kind', 'downloaded')->count())->toBe(1);

    $vueConsole = C::lire($this, $this->admin['jeton'], P::CONSOLE."/{$id}")->assertOk();
    expect($vueConsole->json('data.export'))->toMatchArray(['generated' => true, 'downloaded' => true])
        ->and($vueConsole->getContent())->not->toContain('Facture manquante')->not->toContain('Ma quittance');
});

it('réserve le téléchargement de l\'export au demandeur : ni autre compte, ni opérateur', function (): void {
    $id = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $id, 'complete')->assertOk();

    P::avecPreuve(T::comme($this, $this->autre))->get(P::URL."/{$id}/export")->assertNotFound()->assertJsonPath('code', 'privacy_request_not_found');
    C::reinitialiser($this);
    $this->withToken($this->conformite['jeton'])->getJson(P::URL."/{$id}/export")->assertForbidden();
    $this->withToken($this->admin['jeton'])->getJson(P::URL."/{$id}/export")->assertForbidden();
    expect(AuditLog::query()->where('action', 'privacy.export.downloaded')->count())->toBe(0);
});

it('refuse un export expiré en 410 puis supprime le fichier chiffré', function (): void {
    $id = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $id, 'complete')->assertOk();
    $chemin = (string) PrivacyRequest::query()->findOrFail($id)->export_path;

    T::comme($this, $this->demandeur)->getJson(P::URL."/{$id}")->assertOk()->assertJsonPath('data.export.available', true);
    $this->artisan('privacy:purge-exports')->expectsOutputToContain('0 export(s) supprimé(s).')->assertSuccessful();
    expect(Storage::disk('local')->exists($chemin))->toBeTrue();

    $this->travelTo(now()->addDays(31));
    T::comme($this, $this->demandeur)->getJson(P::URL."/{$id}")->assertOk()->assertJsonPath('data.export.available', false);
    P::avecPreuve(T::comme($this, $this->demandeur))->getJson(P::URL."/{$id}/export")->assertStatus(410)->assertJsonPath('code', 'privacy_export_expired');

    $this->artisan('privacy:purge-exports')->expectsOutputToContain('1 export(s) supprimé(s).')->assertSuccessful();
    expect(Storage::disk('local')->exists($chemin))->toBeFalse()
        ->and(PrivacyRequest::query()->findOrFail($id)->export_path)->toBeNull()
        ->and(PrivacyRequestEvent::query()->where('kind', 'export_purged')->count())->toBe(1);
    P::avecPreuve(T::comme($this, $this->demandeur))->getJson(P::URL."/{$id}/export")->assertStatus(410);
});

it('ne produit pas d\'export pour une rectification : clôture simple et avis au demandeur', function (): void {
    $id = P::deposer($this, $this->demandeur, 'rectification')->assertCreated()->json('data.id');

    P::agir($this, $this->conformite, $id, 'complete')->assertOk()->assertJsonPath('data.export.generated', false);

    expect(N::nombre($this->demandeur, NotificationType::AccountPrivacyCompleted))->toBe(1)
        ->and(N::nombre($this->demandeur, NotificationType::AccountExportReady))->toBe(0)
        ->and(Storage::disk('local')->allFiles())->toBe([]);
    P::avecPreuve(T::comme($this, $this->demandeur))->getJson(P::URL."/{$id}/export")->assertNotFound()->assertJsonPath('code', 'privacy_export_unavailable');
});

it('refuse la clôture d\'une demande saisie tant que l\'identité n\'est pas vérifiée', function (): void {
    $id = ($this->horsApp)('lea.martin@example.test');

    P::agir($this, $this->conformite, $id, 'complete')->assertConflict()->assertJsonPath('code', 'privacy_identity_not_verified');
    ($this->verifier)($id);
    P::agir($this, $this->conformite, $id, 'complete')->assertOk()->assertJsonPath('data.export.generated', true);
});

it('efface un compte par double validation : demande par la conformité, validation par une autre, jamais par l\'auteur ni par un autre rôle', function (): void {
    $id = P::deposer($this, $this->demandeur, 'erasure')->assertCreated()->json('data.id');
    $demander = fn (array $op, string $sujet) => C::ecrire($this, $op['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'privacy.erasure.execute', 'subject_id' => $sujet, 'reason' => 'Demande d\'effacement reçue et vérifiée', 'payload' => [],
    ]);

    P::agir($this, $this->conformite, $id, 'complete')->assertConflict()->assertJsonPath('code', 'privacy_erasure_requires_approval');
    $demander($this->admin, $id)->assertForbidden()->assertJsonPath('code', 'approval_role_forbidden');
    $demander($this->conformite, C::UUID_INCONNU)->assertNotFound()->assertJsonPath('code', 'privacy_request_not_found');

    $acces = P::deposer($this, $this->autre, 'access')->assertCreated()->json('data.id');
    $demander($this->conformite, $acces)->assertUnprocessable();

    $approbation = $demander($this->conformite, $id)->assertCreated();
    expect($approbation->json('data'))->toMatchArray(['action' => 'privacy.erasure.execute', 'status' => 'pending'])
        ->and($approbation->json('data.subject'))->toBe(['type' => 'privacy_request', 'id' => $id]);
    $approbationId = $approbation->json('data.id');
    $url = "/api/v1/console/approvals/{$approbationId}/approve";

    C::ecrire($this, $this->conformite['jeton'], 'POST', $url)->assertForbidden()->assertJsonPath('code', 'approval_self_forbidden');
    C::ecrire($this, $this->admin['jeton'], 'POST', $url)->assertForbidden()->assertJsonPath('code', 'approval_role_forbidden');
    C::ecrire($this, $this->support['jeton'], 'POST', $url)->assertNotFound();
    expect(User::withTrashed()->findOrFail($this->demandeur->id)->trashed())->toBeFalse();

    C::ecrire($this, $this->conformite2['jeton'], 'POST', $url)->assertOk();

    expect(User::withTrashed()->findOrFail($this->demandeur->id)->trashed())->toBeTrue()
        ->and(PrivacyRequest::query()->findOrFail($id)->status->value)->toBe('completed')
        ->and(PrivacyRequestEvent::query()->where('privacy_request_id', $id)->pluck('kind')->map->value->all())->toBe(['received', 'erasure_executed', 'completed'])
        ->and(AuditLog::query()->where('action', 'privacy.request.completed')->count())->toBe(1);

    C::ecrire($this, $this->conformite2['jeton'], 'POST', $url)->assertOk();
    P::agir($this, $this->conformite, $id, 'complete')->assertConflict()->assertJsonPath('code', 'privacy_request_closed');
    $demander($this->conformite, $id)->assertConflict()->assertJsonPath('code', 'privacy_request_closed');
});

it('refuse l\'effacement d\'une demande saisie non vérifiée, sans compte, ou d\'un compte opérateur', function (): void {
    $demander = fn (string $sujet) => C::ecrire($this, $this->conformite['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'privacy.erasure.execute', 'subject_id' => $sujet, 'reason' => 'Demande d\'effacement reçue et vérifiée', 'payload' => [],
    ]);

    $nonVerifiee = ($this->horsApp)('lea.martin@example.test', 'erasure');
    $demander($nonVerifiee)->assertConflict()->assertJsonPath('code', 'privacy_identity_not_verified');

    $sansCompte = ($this->horsApp)('personne@example.test', 'erasure');
    ($this->verifier)($sansCompte);
    $demander($sansCompte)->assertConflict()->assertJsonPath('code', 'privacy_account_required');
    P::agir($this, $this->conformite, $sansCompte, 'complete')->assertOk()->assertJsonPath('data.status', 'completed');

    $operateur = ($this->horsApp)($this->conformite2['user']->email, 'erasure');
    ($this->verifier)($operateur);
    $demander($operateur)->assertForbidden()->assertJsonPath('code', 'operator_account_protected');
});

it('invalide l\'exécution si la demande a été clôturée entre la demande et la validation', function (): void {
    $id = P::deposer($this, $this->demandeur, 'erasure')->assertCreated()->json('data.id');
    $approbation = C::ecrire($this, $this->conformite['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'privacy.erasure.execute', 'subject_id' => $id, 'reason' => 'Demande d\'effacement reçue et vérifiée', 'payload' => [],
    ])->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $id, 'refuse', ['reason' => 'legal_obligation'])->assertOk();

    C::ecrire($this, $this->conformite2['jeton'], 'POST', "/api/v1/console/approvals/{$approbation}/approve")->assertConflict()->assertJsonPath('code', 'approval_stale');
    expect(User::query()->find($this->demandeur->id))->not->toBeNull();
});

it('protège le registre par des déclencheurs : journal en ajout seul, demande close figée, transmission figée', function (): void {
    ($this->lier)($this->org, $this->demandeur);
    $id = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $id, 'forward')->assertOk();
    $transmission = T::comme($this, $this->titulaire)->getJson("/api/v1/org/{$this->org->id}/privacy-requests")->json('data.0.id');
    T::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/privacy-requests/{$transmission}/handled")->assertOk();
    P::agir($this, $this->conformite, $id, 'complete')->assertOk();

    $echoue = function (Closure $requete, string $message): void {
        try {
            $requete();
        } catch (QueryException $e) {
            expect($e->getMessage())->toContain($message);

            return;
        }

        throw new RuntimeException("Écriture acceptée : {$message}");
    };

    $echoue(fn () => DB::table('privacy_request_events')->update(['kind' => 'refused']), 'ajout seul');
    $echoue(fn () => DB::table('privacy_request_events')->delete(), 'ajout seul');
    $echoue(fn () => DB::table('privacy_requests')->delete(), 'ne se supprime pas');
    $echoue(fn () => DB::table('privacy_requests')->update(['kind' => 'erasure']), 'figee');
    $echoue(fn () => DB::table('privacy_requests')->update(['requester_user_id' => $this->autre->id]), 'figee');
    $echoue(fn () => DB::table('privacy_requests')->update(['status' => 'received']), 'cloturee');
    $echoue(fn () => DB::table('privacy_requests')->update(['completed_at' => null]), 'cloturee');
    $echoue(fn () => DB::table('privacy_request_forwards')->delete(), 'ne se supprime pas');
    $echoue(fn () => DB::table('privacy_request_forwards')->update(['organization_id' => $this->autreOrg->id]), 'figee');
    $echoue(fn () => DB::table('privacy_request_forwards')->update(['handled_at' => null]), 'figee');
});

it('refuse deux demandes ouvertes du même type et du même demandeur au niveau de la base', function (): void {
    $id = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    $ligne = (array) DB::table('privacy_requests')->where('id', $id)->first();
    unset($ligne['live_key']);
    $ligne['id'] = (string) Str::uuid7();

    expect(fn () => DB::table('privacy_requests')->insert($ligne))->toThrow(QueryException::class);
});

it('signale une seule fois les demandes à moins de sept jours de l\'échéance et prévient l\'équipe sans contenu', function (): void {
    Notification::fake();
    $proche = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    $loin = P::deposer($this, $this->autre, 'access')->assertCreated()->json('data.id');
    PrivacyRequest::query()->whereKey($loin)->update(['due_at' => now()->addDays(20)->format('Y-m-d H:i:s.u')]);
    PrivacyRequest::query()->whereKey($proche)->update(['due_at' => now()->addDays(6)->format('Y-m-d H:i:s.u')]);

    $this->artisan('privacy:flag-due')->expectsOutputToContain('1 demande(s) signalée(s).')->assertSuccessful();
    $this->artisan('privacy:flag-due')->expectsOutputToContain('0 demande(s) signalée(s).')->assertSuccessful();

    Notification::assertSentOnDemandTimes(PrivacyDeadlineNotification::class, 1);
    expect(PrivacyRequest::query()->findOrFail($proche)->overdue_flagged_at)->not->toBeNull()
        ->and(PrivacyRequest::query()->findOrFail($loin)->overdue_flagged_at)->toBeNull()
        ->and(PrivacyRequestEvent::query()->where('kind', 'due_flagged')->count())->toBe(1);

    P::agir($this, $this->conformite, $proche, 'refuse', ['reason' => 'excessive'])->assertOk();
    PrivacyRequest::query()->whereKey($loin)->update(['due_at' => now()->subDay()->format('Y-m-d H:i:s.u')]);
    $this->artisan('privacy:flag-due')->expectsOutputToContain('1 demande(s) signalée(s).')->assertSuccessful();
});

it('ne signale pas une demande prolongée avant l\'échéance prolongée', function (): void {
    $id = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $id, 'extend', ['reason' => 'volume'])->assertOk();
    PrivacyRequest::query()->whereKey($id)->update(['due_at' => now()->addDays(2)->format('Y-m-d H:i:s.u')]);

    $this->artisan('privacy:flag-due')->expectsOutputToContain('0 demande(s) signalée(s).')->assertSuccessful();
});
