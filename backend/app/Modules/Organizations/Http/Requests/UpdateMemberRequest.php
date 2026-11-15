<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Requests;

use App\Modules\Organizations\Data\MemberScopeData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Support\ScopeInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateMemberRequest extends FormRequest
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
            'role' => ['required_without:scope', Rule::in(MemberRole::invitable())],
            ...ScopeInput::rules('required_without:role'),
        ];
    }

    public function role(): ?MemberRole
    {
        return $this->has('role') ? MemberRole::from((string) $this->string('role')) : null;
    }

    public function scope(): ?MemberScopeData
    {
        return ScopeInput::from($this);
    }
}
