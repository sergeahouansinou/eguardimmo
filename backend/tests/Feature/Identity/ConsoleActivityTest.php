<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    Notification::fake();
    $this->operateur = User::factory()->create(['name' => 'Ops', 'email' => 'ops@exemple.fr']);
    $this->operateur->operator()->create(['granted_at' => now()]);
    activerDeuxFacteurs($this->operateur);
    $this->jeton = $this->operateur->createToken('console', ['operator'])->plainTextToken;
});

function consulter(mixed $test, string $chemin): mixed
{
    return $test->withToken($test->jeton)->getJson('/api/v1/console/activity'.$chemin);
}

it('refuse le journal sans authentification', function (): void {
    $this->getJson('/api/v1/console/activity')->assertUnauthorized();
});

it('refuse le journal à un jeton mobile et à un non-opérateur', function (): void {
    $simple = User::factory()->create();

    $this->withToken($this->operateur->createToken('m', ['mobile'])->plainTextToken)->getJson('/api/v1/console/activity')->assertForbidden();
    auth()->forgetGuards();
    $this->withToken($simple->createToken('c', ['operator'])->plainTextToken)->getJson('/api/v1/console/activity')->assertForbidden();
});

it('liste le journal du plus récent au plus ancien, avec l\'auteur', function (): void {
    $auteur = User::factory()->create(['name' => 'Jeanne', 'email' => 'jeanne@exemple.fr']);
    app(RecordAudit::class)->handle('lease.signed', $auteur->id);
    $this->travel(1)->seconds();
    app(RecordAudit::class)->handle('lease.updated', $auteur->id);

    consulter($this, '?action=lease.')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.action', 'lease.updated')
        ->assertJsonPath('data.1.action', 'lease.signed')
        ->assertJsonPath('data.0.actor', ['id' => $auteur->id, 'name' => 'Jeanne', 'email' => 'jeanne@exemple.fr']);
});

it('filtre par auteur, par entité et par identifiant de requête', function (): void {
    $a = User::factory()->create();
    $b = User::factory()->create();
    app(RecordAudit::class)->handle('x.fait', $a->id, subject: $b);
    app(RecordAudit::class)->handle('x.fait', $b->id);

    consulter($this, '?actor='.$a->id)->assertJsonCount(1, 'data')->assertJsonPath('data.0.actor.id', $a->id);
    consulter($this, '?subject_type=user&subject_id='.$b->id.'&action=x.')->assertJsonCount(1, 'data')->assertJsonPath('data.0.subject', ['type' => 'user', 'id' => $b->id]);

    $requete = AuditLog::query()->where('action', 'console.activity.listed')->firstOrFail()->request_id;
    consulter($this, '?request_id='.$requete)->assertJsonCount(1, 'data')->assertJsonPath('data.0.action', 'console.activity.listed');
});

it('filtre par période en intervalle semi-ouvert', function (): void {
    $this->travelTo('2026-11-10 23:59:59');
    app(RecordAudit::class)->handle('p.avant');
    $this->travelTo('2026-11-11 00:00:00');
    app(RecordAudit::class)->handle('p.debut');
    $this->travelTo('2026-11-12 00:00:00');
    app(RecordAudit::class)->handle('p.fin');

    consulter($this, '?action=p.&from=2026-11-11T00:00:00Z&to=2026-11-12T00:00:00Z')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.action', 'p.debut');
});

it('pagine par curseur', function (): void {
    foreach (range(1, 3) as $n) {
        app(RecordAudit::class)->handle('page.'.$n);
        $this->travel(1)->seconds();
    }

    $premiere = consulter($this, '?action=page.&per_page=2')->assertJsonCount(2, 'data');
    $curseur = $premiere->json('meta.next_cursor');

    expect($curseur)->toBeString();
    consulter($this, '?action=page.&per_page=2&cursor='.$curseur)->assertJsonCount(1, 'data')->assertJsonPath('data.0.action', 'page.1');
});

it('rejette des filtres invalides', function (string $requete, string $champ): void {
    consulter($this, '?'.$requete)->assertUnprocessable()->assertJsonValidationErrors($champ);
})->with([
    ['per_page=101', 'per_page'],
    ['actor=12', 'actor'],
    ['subject_type=inconnu', 'subject_type'],
    ['subject_id=01934f6e-0000-7000-8000-000000000001', 'subject_type'],
    ['action=lease%25', 'action'],
    ['from=2026-11-12&to=2026-11-11', 'to'],
]);

it('montre le détail d\'une entrée avec son différentiel', function (): void {
    $user = User::factory()->create();
    $user->update(['name' => 'Autre nom']);
    $entree = AuditLog::query()->where('action', 'user.updated')->sole();

    $this->withToken($this->jeton)->getJson('/api/v1/console/activity/'.$entree->id)
        ->assertOk()
        ->assertJsonPath('data.id', $entree->id)
        ->assertJsonPath('data.changes.name.new', '[masqué]');
});

it('répond 404 pour une entrée inconnue ou un identifiant mal formé', function (): void {
    $this->withToken($this->jeton)->getJson('/api/v1/console/activity/01934f6e-0000-7000-8000-000000000001')->assertNotFound();
    $this->withToken($this->jeton)->getJson('/api/v1/console/activity/42')->assertNotFound();
});

it('journalise chaque consultation de la console', function (): void {
    $entree = app(RecordAudit::class)->handle('x.fait');

    consulter($this, '?action=x.');
    $this->withToken($this->jeton)->getJson('/api/v1/console/activity/'.$entree->id);

    expect(AuditLog::query()->where('action', 'console.activity.listed')->where('actor_user_id', $this->operateur->id)->sole()->metadata)->toBe(['action' => 'x.'])
        ->and(AuditLog::query()->where('action', 'console.activity.viewed')->sole()->metadata)->toBe(['audit_log_id' => $entree->id]);
});

it('pagine sans perte quand plusieurs entrées tombent dans la même seconde', function (): void {
    foreach (['100', '200', '300'] as $n => $micro) {
        $this->travelTo(CarbonImmutable::parse('2026-11-14 10:00:00.000'.$micro));
        app(RecordAudit::class)->handle('meme.'.($n + 1));
    }

    $premiere = consulter($this, '?action=meme.&per_page=2')->assertJsonPath('data.*.action', ['meme.3', 'meme.2']);

    consulter($this, '?action=meme.&per_page=2&cursor='.$premiere->json('meta.next_cursor'))
        ->assertJsonPath('data.*.action', ['meme.1']);
});

it('rejette un curseur forgé en 422, jamais en 500', function (string $curseur): void {
    consulter($this, '?cursor='.urlencode($curseur))->assertUnprocessable()->assertJsonValidationErrors('cursor');
})->with([
    'illisible' => ['abc'],
    'sans colonnes' => [base64_encode('{"_pointsToNextItems":true}')],
    'valeurs nulles' => [base64_encode('{"occurred_at":null,"id":null,"_pointsToNextItems":true}')],
    'id non uuid' => [base64_encode('{"occurred_at":"2026-11-14 10:00:00","id":"1\' or 1=1","_pointsToNextItems":true}')],
    'colonne en trop' => [base64_encode('{"occurred_at":"2026-11-14 10:00:00","id":"01934f6e-0000-7000-8000-000000000001","action":"x","_pointsToNextItems":true}')],
    'date invalide' => [base64_encode('{"occurred_at":"pas une date","id":"01934f6e-0000-7000-8000-000000000001","_pointsToNextItems":true}')],
]);
