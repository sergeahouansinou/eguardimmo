<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\SupportAccessContext as A;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Mail::fake();
    config(['notifications.push.driver' => 'fake']);
    L::semer();
    $this->travelTo(CarbonImmutable::parse(A::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->admin = L::membre($this->org, MemberRole::Admin);
    $this->gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->comptable = L::membre($this->org, MemberRole::Accountant);
    $this->op = A::operateur();
    O::navigateurAgence($this);
});

function lignes(string $type, ?string $compte = null): array
{
    $requete = DB::table('notifications')->where('type', $type);

    return ($compte === null ? $requete : $requete->where('user_id', $compte))->get()->all();
}

function repondreSupport(mixed $test, string $ticket, array $corps = ['body' => 'Nous regardons.']): void
{
    A::jeton($test);
    $test->withToken($test->op['jeton'])->postJson("/api/v1/console/support/tickets/{$ticket}/messages", avecPreuve($test->op['jeton'], $corps))->assertOk();
}

it('prévient le seul demandeur d\'une réponse du support, hors organisation, sans le texte ni l\'opérateur', function (): void {
    $demandeur = User::factory()->create();
    $ticket = A::demande($this, $demandeur, null);

    repondreSupport($this, $ticket, ['body' => 'Texte confidentiel de la réponse']);

    $liste = lignes('account.support_replied');
    expect($liste)->toHaveCount(1)
        ->and($liste[0]->user_id)->toBe($demandeur->id)
        ->and($liste[0]->audience)->toBe('account')
        ->and($liste[0]->organization_id)->toBeNull()
        ->and($liste[0]->link)->toBe("/support/{$ticket}")
        ->and(json_encode($liste))->not->toContain('Texte confidentiel')->not->toContain('Julie');

    N::comme($this, $demandeur)->getJson(N::URL)->assertOk()->assertJsonPath('data.0.type', 'account.support_replied');
    N::comme($this, User::factory()->create())->getJson(N::URL)->assertOk()->assertJsonCount(0, 'data');
});

it('ne prévient pas d\'une note interne', function (): void {
    $ticket = A::demande($this, User::factory()->create(), null);

    repondreSupport($this, $ticket, ['body' => 'Note à usage interne', 'internal' => true]);

    expect(lignes('account.support_replied'))->toBe([]);
});

it('regroupe les réponses tant que le demandeur n\'a pas lu, puis en crée une nouvelle après sa lecture', function (): void {
    $demandeur = User::factory()->create();
    $ticket = A::demande($this, $demandeur, null);

    $this->travelTo(now()->addMinutes(1));
    repondreSupport($this, $ticket, ['body' => 'Première réponse']);
    $this->travelTo(now()->addMinutes(1));
    repondreSupport($this, $ticket, ['body' => 'Seconde réponse']);
    expect(lignes('account.support_replied'))->toHaveCount(1);

    $this->travelTo(now()->addMinutes(1));
    N::comme($this, $demandeur)->patchJson("/api/v1/support/tickets/{$ticket}", ['read' => true])->assertOk();
    DB::table('notifications')->where('type', 'account.support_replied')->update(['read_at' => now()]);

    $this->travelTo(now()->addMinutes(1));
    repondreSupport($this, $ticket, ['body' => 'Troisième réponse']);
    expect(lignes('account.support_replied'))->toHaveCount(2);
});

it('prévient owner et admin d\'une demande d\'accès, ni le gestionnaire ni le comptable, sans motif ni nom d\'opérateur', function (): void {
    $ticket = A::demande($this, $this->titulaire, $this->org);

    A::demanderAcces($this, $this->op['jeton'], $ticket, ['reason' => 'Motif confidentiel de la demande'])->assertCreated();

    $destinataires = array_column(lignes('support.access_requested'), 'user_id');
    expect($destinataires)->toContain($this->titulaire->id, $this->admin->id)->not->toContain($this->gestionnaire->id, $this->comptable->id)
        ->and(json_encode(lignes('support.access_requested')))->not->toContain('Motif confidentiel')->not->toContain('Julie');
    expect(lignes('support.access_requested')[0]->link)->toBe('/reglages/acces-support');
});

it('prévient owner et admin de la première lecture d\'un accès consenti, une seule fois', function (): void {
    $ticket = A::demande($this, $this->titulaire, $this->org);
    A::accesActif($this, $this->op['jeton'], $ticket, $this->org, $this->titulaire);
    expect(lignes('support.access_used'))->toBe([]);

    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertOk();
    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertOk();

    $destinataires = array_column(lignes('support.access_used'), 'user_id');
    expect($destinataires)->toHaveCount(2)->toContain($this->titulaire->id, $this->admin->id);
});

it('prévient owner et admin d\'un accès d\'urgence dès son ouverture', function (): void {
    $ticket = A::demande($this, $this->titulaire, $this->org);

    A::urgence($this, $this->op['jeton'], $ticket)->assertCreated();

    $destinataires = array_column(lignes('support.access_emergency'), 'user_id');
    expect($destinataires)->toHaveCount(2)->toContain($this->titulaire->id, $this->admin->id)->not->toContain($this->gestionnaire->id);
});

it('ne laisse pas désactiver les notifications d\'accès du support', function (): void {
    O::comme($this, $this->titulaire);
    $types = collect($this->getJson(N::URL.'/preferences')->assertOk()->json('data.types'));

    foreach (['support.access_requested', 'support.access_used', 'support.access_emergency'] as $type) {
        $ligne = $types->firstWhere('type', $type);
        expect($ligne)->not->toBeNull();
        foreach (['in_app', 'email'] as $canal) {
            expect(collect($ligne['channels'])->firstWhere('channel', $canal))->toMatchArray(['enabled' => true, 'locked' => true]);
        }
    }

    O::comme($this, $this->gestionnaire)->getJson(N::URL.'/preferences')->assertOk();
    expect(array_column($this->getJson(N::URL.'/preferences')->json('data.types'), 'type'))->not->toContain('support.access_requested', 'support.access_used', 'support.access_emergency');
});
