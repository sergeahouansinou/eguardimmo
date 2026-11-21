<?php

declare(strict_types=1);

use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Models\SupportTicket;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\SupportAccessContext as A;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(A::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->op = A::operateur();
    O::navigateurAgence($this);
    $this->ticket = A::demande($this, $this->titulaire, $this->org);
    $this->entree = AuditLog::query()->where('action', 'support_ticket.created')->where('organization_id', $this->org->id)->firstOrFail();
    $this->journal = function (string $suite = '', ?string $jeton = null) {
        A::jeton($this);

        return $this->withToken($jeton ?? $this->op['jeton'])->getJson('/api/v1/console/activity'.$suite);
    };
    $this->attendreExpurgee = function ($reponse): void {
        $reponse->assertOk()
            ->assertJsonPath('data.0.action', 'support_ticket.created')
            ->assertJsonPath('data.0.organization_id', $this->org->id)
            ->assertJsonPath('data.0.changes', null)
            ->assertJsonPath('data.0.metadata', null)
            ->assertJsonPath('data.0.ip', null)
            ->assertJsonPath('data.0.user_agent', null)
            ->assertJsonPath('data.0.subject.type', 'support_ticket')
            ->assertJsonPath('data.0.subject.id', null)
            ->assertJsonPath('data.0.actor', ['id' => $this->titulaire->id, 'name' => null, 'email' => null]);
        expect($reponse->getContent())->not->toContain($this->titulaire->email)->not->toContain('Écriture comptable');
    };
});

it('expurge l\'avant/après et le contexte d\'une organisation sans accès vivant, en liste et en détail', function (): void {
    ($this->attendreExpurgee)(($this->journal)("?organization={$this->org->id}&action=support_ticket."));

    A::jeton($this);
    $detail = $this->withToken($this->op['jeton'])->getJson("/api/v1/console/activity/{$this->entree->id}")->assertOk();
    $detail->assertJsonPath('data.changes', null)->assertJsonPath('data.metadata', null)->assertJsonPath('data.actor.name', null);
});

it('expurge aussi sans le filtre organisation : la règle suit l\'entrée, pas la requête', function (): void {
    $reponse = ($this->journal)('?action=support_ticket.')->assertOk();

    expect($reponse->json('data.0.changes'))->toBeNull()->and($reponse->json('data.0.metadata'))->toBeNull();
});

it('sert l\'entrée entière avec un accès vivant sur le périmètre settings', function (): void {
    A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['settings']);

    ($this->journal)("?organization={$this->org->id}&action=support_ticket.")->assertOk()
        ->assertJsonPath('data.0.changes.category.new', 'billing')
        ->assertJsonPath('data.0.actor.email', $this->titulaire->email)
        ->assertJsonPath('data.0.subject.id', $this->ticket);
    A::jeton($this);
    $this->withToken($this->op['jeton'])->getJson("/api/v1/console/activity/{$this->entree->id}")->assertOk()->assertJsonPath('data.changes.category.new', 'billing');
});

it('exige le périmètre settings : un accès team seul n\'ouvre pas le journal', function (): void {
    A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['team']);

    ($this->attendreExpurgee)(($this->journal)("?organization={$this->org->id}&action=support_ticket."));
});

it('n\'ouvre le journal qu\'à l\'opérateur qui détient l\'accès et que pour son organisation', function (): void {
    A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['settings']);
    $second = A::operateur('Paul Durand');

    ($this->attendreExpurgee)(($this->journal)("?organization={$this->org->id}&action=support_ticket.", $second['jeton']));
});

it('n\'ouvre pas le journal d\'une autre organisation que celle de l\'accès', function (): void {
    A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['settings']);
    $autre = T::organisation('Agence Rivale');
    $titulaire = L::titulaire($autre);
    A::demande($this, $titulaire, $autre);

    $reponse = ($this->journal)("?organization={$autre->id}&action=support_ticket.")->assertOk();

    expect($reponse->json('data.0.changes'))->toBeNull()->and($reponse->json('data.0.actor.email'))->toBeNull();
});

it('expurge dès que l\'accès est expiré ou révoqué', function (): void {
    $id = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['settings']);
    ($this->journal)("?organization={$this->org->id}&action=support_ticket.")->assertJsonPath('data.0.changes.category.new', 'billing');

    $this->travelTo(now()->addHours(25));
    ($this->attendreExpurgee)(($this->journal)("?organization={$this->org->id}&action=support_ticket."));

    $this->travelTo(CarbonImmutable::parse(A::AUJOURDHUI));
    SupportAccessGrant::query()->whereKey($id)->update(['expires_at' => now()->addHours(10)->format('Y-m-d H:i:s.u')]);
    ($this->journal)("?organization={$this->org->id}&action=support_ticket.")->assertJsonPath('data.0.changes.category.new', 'billing');

    O::preuve($this);
    A::organisation($this, $this->org, $this->titulaire, "/{$id}/revoke", 'POST')->assertOk();
    ($this->attendreExpurgee)(($this->journal)("?organization={$this->org->id}&action=support_ticket."));
});

it('expurge dès que la demande de support est résolue, même si l\'accès n\'a pas été éteint', function (): void {
    A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire, ['settings']);
    SupportTicket::query()->whereKey($this->ticket)->update(['status' => TicketStatus::Resolved]);

    ($this->attendreExpurgee)(($this->journal)("?organization={$this->org->id}&action=support_ticket."));
});

it('laisse les entrées de plateforme, sans organisation, telles quelles', function (): void {
    $auteur = $this->titulaire;
    app(RecordAudit::class)->handle('plateforme.fait', $auteur->id, metadata: ['clef' => 'valeur'], changes: ['x' => ['old' => 1, 'new' => 2]]);

    ($this->journal)('?action=plateforme.')->assertOk()
        ->assertJsonPath('data.0.metadata', ['clef' => 'valeur'])
        ->assertJsonPath('data.0.changes.x.new', 2)
        ->assertJsonPath('data.0.actor.email', $auteur->email);
});
