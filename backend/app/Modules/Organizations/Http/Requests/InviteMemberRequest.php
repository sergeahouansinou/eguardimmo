<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Requests;

use App\Modules\Organizations\Data\InvitationData;
use App\Modules\Organizations\Data\MemberScopeData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\ScopeType;
use App\Modules\Organizations\Support\ScopeInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class InviteMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc', 'max:120'],
            'first_name' => ['required', 'string', 'max:60'],
            'last_name' => ['required', 'string', 'max:60'],
            'role' => ['required', Rule::in(MemberRole::invitable())],
            ...ScopeInput::rules('required'),
            'message' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function toData(): InvitationData
    {
        $message = trim((string) $this->string('message'));

        return new InvitationData(
            trim((string) $this->string('email')),
            trim((string) $this->string('first_name')),
            trim((string) $this->string('last_name')),
            MemberRole::from((string) $this->string('role')),
            ScopeInput::from($this) ?? new MemberScopeData(ScopeType::All),
            $message === '' ? null : $message,
        );
    }
}
