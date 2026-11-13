<?php

declare(strict_types=1);

namespace App\Modules\Identity\Listeners;

use App\Modules\Identity\Actions\RecordDeviceLogin;
use App\Modules\Identity\Actions\RecordSuccessfulLogin;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AbsoluteSession;
use App\Shared\Audit\RecordAudit;
use Illuminate\Auth\Events\Login;
use Illuminate\Http\Request;

final readonly class StartWebSession
{
    public function __construct(
        private AbsoluteSession $session,
        private RecordDeviceLogin $appareils,
        private RecordSuccessfulLogin $derniereConnexion,
        private RecordAudit $audit,
        private Request $request,
    ) {}

    public function handle(Login $evenement): void
    {
        if ($evenement->guard !== 'web' || ! $evenement->user instanceof User) {
            return;
        }

        if ($this->request->hasSession()) {
            $this->session->start($this->request->session(), $evenement->user);
        }

        $this->derniereConnexion->handle($evenement->user);

        $navigateur = (string) $this->request->userAgent();
        $this->appareils->handle($evenement->user, 'web|'.$navigateur, $navigateur !== '' ? $navigateur : 'navigateur inconnu');
        $this->audit->handle('auth.login.succeeded', $evenement->user->id, ['channel' => 'web']);
    }
}
