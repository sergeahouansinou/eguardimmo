<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Models\PrivacyRequestEvent;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Console\ConsoleContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Privacy\PrivacyContext as P;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Mail::fake();
    Storage::fake('local');
    config(['notifications.push.driver' => 'fake']);
    $this->admin = C::operateur(['admin'], 'Alice Admin');
    $this->support = C::operateur(['support'], 'Sam Support');
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->conformite2 = C::operateur(['compliance'], 'Corinne Conformité');
    $this->demandeur = User::factory()->create(['name' => 'Léa Martin', 'email' => 'lea.martin@example.test']);
    $this->autre = User::factory()->create(['name' => 'Paul Autre']);
    $this->org = T::organisation('Agence du Port');
    $this->titulaire = L::titulaire($this->org);
    $this->gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->verifier = fn (string $id, string $methode = 'known_channel') => P::agir($this, $this->conformite, $id, 'verify', ['verification_method' => $methode]);
});

it('dépose une demande depuis le compte : échéance à un mois, identité par session, journal de preuve et audit', function (): void {
    $this->travelTo(now()->setDate(2026, 11, 10)->setTime(14, 0));

    $reponse = P::deposer($this, $this->demandeur, 'access')->assertCreated();

    expect($reponse->json('data'))->toMatchArray([
        'kind' => 'access', 'channel' => 'account', 'status' => 'received', 'extended_until' => null, 'refusal_reason' => null, 'export' => null,
    ])
        ->and(array_keys($reponse->json('data')))->toEqualCanonicalizing(['id', 'kind', 'channel', 'status', 'received_at', 'due_at', 'extended_until', 'deadline', 'refusal_reason', 'completed_at', 'export'])
        ->and($reponse->json('data.due_at'))->toStartWith('2026-12-10T23:59:59');

    $demande = PrivacyRequest::query()->findOrFail($reponse->json('data.id'));

    expect($demande->requester_user_id)->toBe($this->demandeur->id)
        ->and($demande->identity_verified_by?->value)->toBe('account_session')
        ->and(PrivacyRequestEvent::query()->where('privacy_request_id', $demande->id)->pluck('kind')->map->value->all())->toBe(['received'])
        ->and(AuditLog::query()->where('action', 'privacy.request.received')->count())->toBe(1);
});

it('retombe sur le dernier jour du mois : 31 janvier, 28 février puis 29 en année bissextile', function (): void {
    $this->travelTo(now()->setDate(2027, 1, 31)->setTime(9, 0));
    expect(P::deposer($this, $this->demandeur)->assertCreated()->json('data.due_at'))->toStartWith('2027-02-28T23:59:59');

    $this->travelTo(now()->setDate(2028, 1, 31)->setTime(9, 0));
    expect(P::deposer($this, $this->autre)->assertCreated()->json('data.due_at'))->toStartWith('2028-02-29T23:59:59');
});

it('n\'accepte du client que le type de demande : ni demandeur, ni statut, ni échéance', function (): void {
    P::deposer($this, $this->demandeur, 'access', [
        'requester_user_id' => $this->autre->id, 'status' => 'completed', 'due_at' => '2030-01-01', 'channel' => 'letter', 'identity_verified_by' => 'video_call',
    ])->assertCreated();

    $demande = PrivacyRequest::query()->firstOrFail();

    expect($demande->requester_user_id)->toBe($this->demandeur->id)
        ->and($demande->status->value)->toBe('received')
        ->and($demande->channel->value)->toBe('account')
        ->and($demande->identity_verified_by?->value)->toBe('account_session')
        ->and($demande->due_at->year)->toBe((int) now()->addMonth()->format('Y'));

    P::deposer($this, $this->demandeur, 'inconnu')->assertUnprocessable();
    T::comme($this, $this->demandeur)->postJson(P::URL, [])->assertUnprocessable();
});

it('refuse une seconde demande ouverte du même type, en autorise un autre type, limite à trois par jour', function (): void {
    P::deposer($this, $this->demandeur, 'access')->assertCreated();
    P::deposer($this, $this->demandeur, 'access')->assertConflict()->assertJsonPath('code', 'privacy_request_exists');
    P::deposer($this, $this->demandeur, 'rectification')->assertCreated();
    P::deposer($this, $this->demandeur, 'objection')->assertStatus(429);
    P::deposer($this, $this->autre, 'access')->assertCreated();
});

it('libère le type après la clôture de la demande', function (): void {
    $id = P::deposer($this, $this->demandeur, 'rectification')->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $id, 'refuse', ['reason' => 'manifestly_unfounded'])->assertOk();

    P::deposer($this, $this->demandeur, 'rectification')->assertCreated();
});

it('garde les routes du demandeur : 401 sans jeton, 403 jeton opérateur ou e-mail non vérifié', function (): void {
    $id = P::deposer($this, $this->demandeur)->assertCreated()->json('data.id');

    foreach ([['POST', P::URL], ['GET', P::URL], ['GET', P::URL."/{$id}"], ['GET', P::URL."/{$id}/export"]] as [$methode, $url]) {
        C::reinitialiser($this);
        $this->json($methode, $url)->assertUnauthorized();
        C::reinitialiser($this);
        $this->withToken($this->conformite['jeton'])->json($methode, $url, ['kind' => 'access'])->assertForbidden();
    }

    $nonVerifie = User::factory()->unverified()->create();
    T::comme($this, $nonVerifie)->postJson(P::URL, ['kind' => 'access'])->assertForbidden();
    T::comme($this, $nonVerifie)->getJson(P::URL)->assertForbidden();
});

it('ne montre à un compte que ses propres demandes : une demande d\'autrui est introuvable', function (): void {
    $mienne = P::deposer($this, $this->demandeur)->assertCreated()->json('data.id');
    $sienne = P::deposer($this, $this->autre)->assertCreated()->json('data.id');

    $liste = T::comme($this, $this->demandeur)->getJson(P::URL)->assertOk();
    expect(array_column($liste->json('data'), 'id'))->toBe([$mienne]);

    T::comme($this, $this->demandeur)->getJson(P::URL."/{$mienne}")->assertOk()->assertJsonPath('data.id', $mienne);
    T::comme($this, $this->demandeur)->getJson(P::URL."/{$sienne}")->assertNotFound()->assertJsonPath('code', 'privacy_request_not_found');
    P::avecPreuve(T::comme($this, $this->demandeur))->getJson(P::URL."/{$sienne}/export")->assertNotFound()->assertJsonPath('code', 'privacy_request_not_found');
    T::comme($this, $this->demandeur)->getJson(P::URL.'/'.C::UUID_INCONNU)->assertNotFound();
    T::comme($this, $this->demandeur)->getJson(P::URL.'/pas-un-uuid')->assertNotFound();
});

it('saisit une demande reçue par courrier : adresse chiffrée avec empreinte, échéance depuis la réception, compte lié', function (): void {
    $this->travelTo(now()->setDate(2026, 11, 20)->setTime(10, 0));

    $reponse = C::ecrire($this, $this->conformite['jeton'], 'POST', P::CONSOLE, [
        'kind' => 'erasure', 'channel' => 'letter', 'requester_email' => 'LEA.MARTIN@example.test', 'received_on' => '2026-11-02',
    ])->assertCreated();

    expect($reponse->json('data'))->toMatchArray(['kind' => 'erasure', 'channel' => 'letter', 'status' => 'received', 'identity_verified_by' => null, 'overdue' => false])
        ->and($reponse->json('data.requester'))->toBe(['account_id' => $this->demandeur->id, 'name' => 'Léa Martin', 'email' => 'lea.martin@example.test'])
        ->and($reponse->json('data.due_at'))->toStartWith('2026-12-02T23:59:59')
        ->and($reponse->json('data.events'))->toHaveCount(1);

    $brut = DB::table('privacy_requests')->first();

    expect($brut->requester_email)->not->toContain('example.test')
        ->and($brut->requester_email_fingerprint)->toHaveLength(64)
        ->and(AuditLog::query()->where('action', 'privacy.request.received')->get()->every(fn (AuditLog $l): bool => ! str_contains(json_encode($l->metadata), 'example.test')))->toBeTrue();
});

it('saisit une demande d\'une personne sans compte, sans la lier à un compte', function (): void {
    $reponse = C::ecrire($this, $this->conformite['jeton'], 'POST', P::CONSOLE, [
        'kind' => 'access', 'channel' => 'email', 'requester_email' => 'inconnu@example.test',
    ])->assertCreated();

    expect($reponse->json('data.requester'))->toBe(['account_id' => null, 'name' => null, 'email' => 'inconnu@example.test']);

    C::ecrire($this, $this->conformite['jeton'], 'POST', P::CONSOLE, ['kind' => 'access', 'channel' => 'email', 'requester_email' => 'Inconnu@example.test'])
        ->assertConflict()->assertJsonPath('code', 'privacy_request_exists');
});

it('valide la saisie par la conformité en liste blanche', function (): void {
    $valide = ['kind' => 'access', 'channel' => 'letter', 'requester_email' => 'x@example.test'];

    foreach ([
        ['kind' => 'inconnu'], ['kind' => null], ['channel' => 'account'], ['channel' => null], ['requester_email' => 'pas-un-mail'], ['requester_email' => null],
        ['received_on' => now()->addDay()->toDateString()], ['received_on' => now()->subYears(2)->toDateString()], ['received_on' => '02/11/2026'],
    ] as $erreur) {
        C::ecrire($this, $this->conformite['jeton'], 'POST', P::CONSOLE, [...$valide, ...$erreur])->assertUnprocessable();
    }

    expect(PrivacyRequest::query()->count())->toBe(0);
});

it('réserve l\'écriture à la conformité et la lecture à la conformité et à l\'administrateur', function (): void {
    $id = P::deposer($this, $this->demandeur)->assertCreated()->json('data.id');

    foreach ([$this->admin, $this->support] as $operateur) {
        C::ecrire($this, $operateur['jeton'], 'POST', P::CONSOLE, ['kind' => 'access', 'channel' => 'email', 'requester_email' => 'a@example.test'])
            ->assertForbidden()->assertJsonPath('code', 'operator_role_required');
        P::agir($this, $operateur, $id, 'verify', ['verification_method' => 'video_call'])->assertForbidden()->assertJsonPath('code', 'operator_role_required');
    }

    C::lire($this, $this->admin['jeton'], P::CONSOLE)->assertOk();
    C::lire($this, $this->admin['jeton'], P::CONSOLE."/{$id}")->assertOk();
    C::lire($this, $this->conformite['jeton'], P::CONSOLE)->assertOk();
    C::lire($this, $this->support['jeton'], P::CONSOLE)->assertForbidden()->assertJsonPath('code', 'operator_role_required');
    C::lire($this, $this->support['jeton'], P::CONSOLE."/{$id}")->assertForbidden();
    C::lire($this, $this->conformite['jeton'], P::CONSOLE.'/'.C::UUID_INCONNU)->assertNotFound()->assertJsonPath('code', 'privacy_request_not_found');
});

it('liste les demandes avec filtres, compteurs et pagination, sans export ni contenu', function (): void {
    $a = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    P::deposer($this, $this->demandeur, 'erasure')->assertCreated();
    P::deposer($this, $this->autre, 'access')->assertCreated();
    P::agir($this, $this->conformite, $a, 'refuse', ['reason' => 'excessive'])->assertOk();

    $tout = C::lire($this, $this->admin['jeton'], P::CONSOLE)->assertOk();

    expect($tout->json('data'))->toHaveCount(3)
        ->and($tout->json('meta'))->toMatchArray(['has_more' => false, 'open_count' => 2, 'overdue_count' => 0])
        ->and(array_keys($tout->json('data.0')))->toEqualCanonicalizing(['id', 'kind', 'channel', 'status', 'received_at', 'due_at', 'extended_until', 'extension_reason', 'deadline', 'overdue', 'identity_verified_by', 'identity_verified_at', 'requester', 'forwards', 'refusal_reason', 'completed_at', 'export']);

    C::lire($this, $this->admin['jeton'], P::CONSOLE.'?status=refused')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $a);
    C::lire($this, $this->admin['jeton'], P::CONSOLE.'?kind=erasure')->assertOk()->assertJsonCount(1, 'data');
    C::lire($this, $this->admin['jeton'], P::CONSOLE.'?overdue=1')->assertOk()->assertJsonCount(0, 'data');
    C::lire($this, $this->admin['jeton'], P::CONSOLE.'?status=inconnu')->assertUnprocessable();
    C::lire($this, $this->admin['jeton'], P::CONSOLE.'?cursor=nimporte')->assertUnprocessable();

    $page = C::lire($this, $this->admin['jeton'], P::CONSOLE.'?per_page=2')->assertOk();
    $suite = C::lire($this, $this->admin['jeton'], P::CONSOLE.'?per_page=2&cursor='.$page->json('meta.next_cursor'))->assertOk();
    expect($page->json('meta.has_more'))->toBeTrue()->and($suite->json('data'))->toHaveCount(1)->and($suite->json('meta.has_more'))->toBeFalse();

    PrivacyRequest::query()->whereIn('status', ['received', 'in_progress'])->update(['due_at' => now()->subDay()->format('Y-m-d H:i:s.u')]);
    C::lire($this, $this->admin['jeton'], P::CONSOLE.'?overdue=1')->assertOk()->assertJsonCount(2, 'data');
    expect(C::lire($this, $this->admin['jeton'], P::CONSOLE)->json('meta.overdue_count'))->toBe(2);
});

it('vérifie l\'identité d\'une demande saisie : méthode fermée, sans effet répété, refusée une fois clôturée', function (): void {
    $id = C::ecrire($this, $this->conformite['jeton'], 'POST', P::CONSOLE, ['kind' => 'access', 'channel' => 'email', 'requester_email' => 'lea.martin@example.test'])->json('data.id');

    P::agir($this, $this->conformite, $id, 'verify', ['verification_method' => 'account_session'])->assertUnprocessable();
    P::agir($this, $this->conformite, $id, 'verify', ['verification_method' => 'pas_une_methode'])->assertUnprocessable();
    P::agir($this, $this->conformite, $id, 'verify')->assertUnprocessable();

    $reponse = ($this->verifier)($id, 'video_call')->assertOk();
    expect($reponse->json('data'))->toMatchArray(['status' => 'in_progress', 'identity_verified_by' => 'video_call']);

    ($this->verifier)($id, 'document_seen')->assertOk()->assertJsonPath('data.identity_verified_by', 'video_call');
    expect(PrivacyRequestEvent::query()->where('kind', 'verified')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'privacy.request.verified')->count())->toBe(1);

    P::agir($this, $this->conformite, $id, 'refuse', ['reason' => 'identity_unverified'])->assertOk();
    ($this->verifier)($id)->assertConflict()->assertJsonPath('code', 'privacy_request_closed');
});

it('prolonge une seule fois, avant l\'échéance : 31 janvier, trois mois en tout', function (): void {
    $this->travelTo(now()->setDate(2027, 1, 31)->setTime(9, 0));
    $conformite = C::operateur(['compliance'], 'Clara Conformité');
    $id = P::deposer($this, $this->demandeur)->assertCreated()->json('data.id');

    P::agir($this, $conformite, $id, 'extend', ['reason' => 'inconnu'])->assertUnprocessable();
    $reponse = P::agir($this, $conformite, $id, 'extend', ['reason' => 'complexity'])->assertOk();

    expect($reponse->json('data'))->toMatchArray(['status' => 'in_progress', 'extension_reason' => 'complexity'])
        ->and($reponse->json('data.extended_until'))->toStartWith('2027-04-30T23:59:59')
        ->and($reponse->json('data.deadline'))->toStartWith('2027-04-30T23:59:59')
        ->and($reponse->json('data.due_at'))->toStartWith('2027-02-28T23:59:59');

    P::agir($this, $conformite, $id, 'extend', ['reason' => 'volume'])->assertConflict()->assertJsonPath('code', 'privacy_already_extended');

    $autre = P::deposer($this, $this->autre)->assertCreated()->json('data.id');
    PrivacyRequest::query()->whereKey($autre)->update(['due_at' => now()->subHour()->format('Y-m-d H:i:s.u')]);
    P::agir($this, $conformite, $autre, 'extend', ['reason' => 'volume'])->assertConflict()->assertJsonPath('code', 'privacy_deadline_passed');
});

it('refuse une demande avec un motif fermé, la clôt et prévient le demandeur', function (): void {
    $id = P::deposer($this, $this->demandeur)->assertCreated()->json('data.id');

    P::agir($this, $this->conformite, $id, 'refuse', ['reason' => 'libre'])->assertUnprocessable();
    P::agir($this, $this->conformite, $id, 'refuse')->assertUnprocessable();
    $reponse = P::agir($this, $this->conformite, $id, 'refuse', ['reason' => 'legal_obligation'])->assertOk();

    expect($reponse->json('data'))->toMatchArray(['status' => 'refused', 'refusal_reason' => 'legal_obligation'])
        ->and(N::nombre($this->demandeur, NotificationType::AccountPrivacyCompleted))->toBe(1)
        ->and(AuditLog::query()->where('action', 'privacy.request.refused')->count())->toBe(1);

    T::comme($this, $this->demandeur)->getJson(P::URL."/{$id}")->assertOk()->assertJsonPath('data.status', 'refused')->assertJsonPath('data.refusal_reason', 'legal_obligation');
    P::agir($this, $this->conformite, $id, 'refuse', ['reason' => 'excessive'])->assertConflict()->assertJsonPath('code', 'privacy_request_closed');
    P::agir($this, $this->conformite, $id, 'complete')->assertConflict()->assertJsonPath('code', 'privacy_request_closed');
    P::agir($this, $this->conformite, $id, 'extend', ['reason' => 'volume'])->assertConflict();
});

it('exige la preuve 2FA et refuse une demande inconnue sur chaque écriture de la conformité', function (): void {
    $corps = ['verify' => ['verification_method' => 'video_call'], 'extend' => ['reason' => 'volume'], 'forward' => [], 'complete' => [], 'refuse' => ['reason' => 'excessive']];

    foreach ($corps as $action => $donnees) {
        C::ecrireBrut($this, $this->conformite['jeton'], 'POST', P::CONSOLE.'/'.C::UUID_INCONNU."/{$action}")->assertUnprocessable()->assertJsonPath('code', 'operator_proof_required');
        P::agir($this, $this->conformite, C::UUID_INCONNU, $action, $donnees)->assertNotFound()->assertJsonPath('code', 'privacy_request_not_found');
    }
});

it('exige une preuve de détention du compte pour l\'accès, la portabilité et l\'effacement : rien n\'est créé ni notifié sans elle', function (string $type): void {
    P::deposer($this, $this->demandeur, $type, [], false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    P::deposer($this, $this->demandeur, $type, ['password' => 'mot-de-passe-faux'], false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    expect(PrivacyRequest::query()->count())->toBe(0)
        ->and(N::nombre($this->demandeur, NotificationType::AccountPrivacyReceived))->toBe(0);

    P::deposer($this, $this->demandeur, $type)->assertCreated();

    expect(PrivacyRequest::query()->count())->toBe(1);
})->with(['access', 'portability', 'erasure']);

it('laisse déposer sans preuve les demandes qui ne sortent ni ne détruisent de données, et prévient le titulaire dans tous les cas', function (string $type): void {
    $id = P::deposer($this, $this->demandeur, $type, [], false)->assertCreated()->json('data.id');

    expect(N::nombre($this->demandeur, NotificationType::AccountPrivacyReceived))->toBe(1)
        ->and(PrivacyRequest::query()->findOrFail($id)->kind->value)->toBe($type);
})->with(['rectification', 'restriction', 'objection']);

it('prévient le titulaire du compte quand une demande sensible est déposée avec une preuve valide', function (): void {
    P::deposer($this, $this->demandeur, 'erasure')->assertCreated();

    expect(N::nombre($this->demandeur, NotificationType::AccountPrivacyReceived))->toBe(1)
        ->and(N::nombre($this->autre, NotificationType::AccountPrivacyReceived))->toBe(0);
});

it('prévient le compte lié quand la conformité saisit une demande reçue par courrier, sans prévenir quand aucun compte ne porte l\'adresse', function (): void {
    C::ecrire($this, $this->conformite['jeton'], 'POST', P::CONSOLE, ['kind' => 'erasure', 'channel' => 'letter', 'requester_email' => 'inconnu@example.test'])->assertCreated();

    expect(N::nombre($this->demandeur, NotificationType::AccountPrivacyReceived))->toBe(0);

    C::ecrire($this, $this->conformite['jeton'], 'POST', P::CONSOLE, ['kind' => 'erasure', 'channel' => 'letter', 'requester_email' => 'lea.martin@example.test'])->assertCreated();

    expect(N::nombre($this->demandeur, NotificationType::AccountPrivacyReceived))->toBe(1)
        ->and(N::nombre($this->autre, NotificationType::AccountPrivacyReceived))->toBe(0);
});
